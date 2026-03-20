package services

import (
	internal "changeme/internal"
	"net/url"
	"os/exec"
	"regexp"

	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type PrintSpool struct {
	ID int64 `db:"id" json:"id"`

	PrintID int64 `db:"print_id" json:"printId"`
	SpoolID int64 `db:"spool_id" json:"spoolId"`

	GramsUsed int `db:"grams_used" json:"gramsUsed"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`

	SpoolCode   string `db:"spool_code" json:"spoolCode"`
	TotalWeight int    `db:"total_weight" json:"totalWeight"`
	UsedWeight  int    `db:"used_weight" json:"usedWeight"`
	Vendor      string `db:"vendor" json:"vendor"`
	Material    string `db:"material" json:"material"`
	Color       string `db:"color" json:"color"`
	ColorHex    string `db:"color_hex" json:"colorHex"`
}

type PrintModel struct {
	ID   int64  `db:"id" json:"id"`
	Name string `db:"name" json:"name"`
	Ext  string `db:"ext" json:"ext"`
	Size int64  `db:"size" json:"size"`
	Data []byte `json:"data"`
}

type Print struct {
	ID          int64      `db:"id" json:"id"`
	Name        string     `db:"name" json:"name"`
	Status      string     `db:"status" json:"status"`
	Notes       string     `db:"notes" json:"notes"`
	DatePrinted *time.Time `db:"date_printed" json:"datePrinted"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`

	Spools []PrintSpool `json:"spools,omitempty"`
	Models []PrintModel `json:"models,omitempty"`
}

type PrintQueryParams struct {
	Search    string `json:"search"`
	SortBy    string `json:"sortBy"`
	SortOrder string `json:"sortOrder"`
	Limit     int    `json:"limit"`
	Offset    int    `json:"offset"`
}

type PrintQueryResult struct {
	Prints []Print `json:"prints"`
	Total  int     `json:"total"`
}

type PrintService struct {
	repo      *PrintRepository
	modelsDir string
}

// validPrintSortColumns is the allowlist for ORDER BY to prevent SQL injection.
var validPrintSortColumns = map[string]bool{
	"id":           true,
	"name":         true,
	"status":       true,
	"date_printed": true,
	"created_at":   true,
	"updated_at":   true,
}

func NewPrintService(database *Database) *PrintService {
	return &PrintService{repo: NewPrintRepository(database.db)}
}

func (s *PrintService) CreatePrint(p Print) (int64, error) {
	now := time.Now()

	tx, err := s.repo.Begin()
	if err != nil {
		slog.Error("failed to begin transaction", "error", err)
		return 0, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	printID, err := s.repo.InsertPrint(tx, p, now)
	if err != nil {
		slog.Error("failed to insert print", "error", err)
		return 0, fmt.Errorf("inserting print: %w", err)
	}

	for _, ps := range p.Spools {
		if err := s.repo.InsertPrintSpool(tx, printID, ps, now); err != nil {
			slog.Error("failed to insert print_spool", "spoolId", ps.SpoolID, "error", err)
			return 0, fmt.Errorf("inserting print_spool for spool %d: %w", ps.SpoolID, err)
		}
		if err := s.repo.AddSpoolUsedWeight(tx, ps.SpoolID, ps.GramsUsed, now); err != nil {
			slog.Error("failed to update spool weight", "spoolId", ps.SpoolID, "error", err)
			return 0, fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		slog.Error("failed to commit create print transaction", "error", err)
		return 0, fmt.Errorf("committing transaction: %w", err)
	}

	slog.Info("print created", "id", printID, "name", p.Name)
	return printID, nil
}

func (s *PrintService) UpdatePrint(p Print) error {
	if p.ID == 0 {
		return errors.New("print ID is required")
	}

	now := time.Now()

	tx, err := s.repo.Begin()
	if err != nil {
		slog.Error("failed to begin transaction", "id", p.ID, "error", err)
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.repo.UpdatePrintFields(tx, p, now); err != nil {
		slog.Error("failed to update print fields", "id", p.ID, "error", err)
		return fmt.Errorf("updating print %d: %w", p.ID, err)
	}

	existingSpools, err := s.repo.GetPrintSpools(tx, p.ID)
	if err != nil {
		slog.Error("failed to load existing spools", "id", p.ID, "error", err)
		return fmt.Errorf("loading existing spools for print %d: %w", p.ID, err)
	}

	existingMap := make(map[int64]int, len(existingSpools))
	for _, es := range existingSpools {
		existingMap[es.SpoolID] = es.GramsUsed
	}

	// Single pass over incoming: upsert or insert
	for _, ps := range p.Spools {
		if oldGrams, exists := existingMap[ps.SpoolID]; exists {
			delete(existingMap, ps.SpoolID) // mark as seen
			delta := ps.GramsUsed - oldGrams
			if err := s.repo.UpsertPrintSpool(tx, p.ID, ps, now); err != nil {
				slog.Error("failed to update print_spool", "spoolId", ps.SpoolID, "error", err)
				return fmt.Errorf("updating print_spool for spool %d: %w", ps.SpoolID, err)
			}
			if delta != 0 {
				if err := s.repo.AddSpoolUsedWeight(tx, ps.SpoolID, delta, now); err != nil {
					slog.Error("failed to update spool weight delta", "spoolId", ps.SpoolID, "error", err)
					return fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
				}
			}
		} else {
			if err := s.repo.InsertPrintSpool(tx, p.ID, ps, now); err != nil {
				slog.Error("failed to insert new print_spool", "spoolId", ps.SpoolID, "error", err)
				return fmt.Errorf("inserting print_spool for spool %d: %w", ps.SpoolID, err)
			}
			if err := s.repo.AddSpoolUsedWeight(tx, ps.SpoolID, ps.GramsUsed, now); err != nil {
				slog.Error("failed to update spool weight", "spoolId", ps.SpoolID, "error", err)
				return fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
			}
		}
	}

	// Whatever's left in existingMap was removed
	for spoolID, oldGrams := range existingMap {
		if err := s.repo.SubtractSpoolUsedWeight(tx, spoolID, oldGrams, now); err != nil {
			slog.Error("failed to revert spool weight", "spoolId", spoolID, "error", err)
			return fmt.Errorf("reverting spool weight for removed spool %d: %w", spoolID, err)
		}
		if err := s.repo.DeletePrintSpool(tx, p.ID, spoolID); err != nil {
			slog.Error("failed to remove print_spool", "spoolId", spoolID, "error", err)
			return fmt.Errorf("removing print_spool for spool %d: %w", spoolID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		slog.Error("failed to commit update print transaction", "id", p.ID, "error", err)
		return fmt.Errorf("committing print update transaction: %w", err)
	}

	slog.Info("print updated", "id", p.ID, "name", p.Name)
	return nil
}

func (s *PrintService) DeletePrint(id int64, restoreSpoolGrams bool) error {
	if id == 0 {
		return errors.New("invalid print ID")
	}

	now := time.Now()

	tx, err := s.repo.Begin()
	if err != nil {
		slog.Error("failed to begin transaction", "id", id, "error", err)
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if restoreSpoolGrams {
		printSpools, err := s.repo.GetPrintSpools(tx, id)
		if err != nil {
			slog.Error("failed to load print spools", "id", id, "error", err)
			return fmt.Errorf("loading print spools for print %d: %w", id, err)
		}
		for _, ps := range printSpools {
			if err := s.repo.SubtractSpoolUsedWeight(tx, ps.SpoolID, ps.GramsUsed, now); err != nil {
				slog.Error("failed to revert spool weight", "spoolId", ps.SpoolID, "error", err)
				return fmt.Errorf("reverting spool weight for spool %d: %w", ps.SpoolID, err)
			}
		}
	}

	modelIDs, err := s.repo.GetModelIDsForPrint(tx, id)
	if err != nil {
		slog.Error("failed to load model ids", "id", id, "error", err)
		return fmt.Errorf("loading model ids for print %d: %w", id, err)
	}

	if err := s.repo.DeletePrintModels(tx, id); err != nil {
		slog.Error("failed to delete print_models", "id", id, "error", err)
		return fmt.Errorf("deleting print_models for print %d: %w", id, err)
	}

	var orphaned []PrintModel
	if len(modelIDs) > 0 {
		orphaned, err = s.repo.FindOrphanedModels(tx, modelIDs)
		if err != nil {
			slog.Error("failed to find orphaned models", "id", id, "error", err)
			return fmt.Errorf("finding orphaned models: %w", err)
		}
		for _, m := range orphaned {
			if err := s.repo.DeleteModelByID(tx, m.ID); err != nil {
				slog.Error("failed to delete orphaned model", "modelId", m.ID, "error", err)
				return fmt.Errorf("deleting orphaned model %d: %w", m.ID, err)
			}
		}
	}

	if err := s.repo.DeletePrint(tx, id); err != nil {
		slog.Error("failed to delete print record", "id", id, "error", err)
		return fmt.Errorf("deleting print %d: %w", id, err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("failed to commit delete print transaction", "id", id, "error", err)
		return err
	}

	for _, m := range orphaned {
		filePath := filepath.Join(s.modelsDir, fmt.Sprintf("%d_%s.%s", m.ID, m.Name, m.Ext))
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			slog.Error("failed to delete model file", "modelId", m.ID, "path", filePath, "error", err)
		}
	}

	slog.Info("print deleted", "id", id, "restoreSpoolGrams", restoreSpoolGrams)
	return nil
}

func (s *PrintService) GetPrintModels(printID int64) ([]PrintModel, error) {
	models, err := s.repo.GetModelsForPrint(printID)
	if err != nil {
		slog.Error("failed to get print models", "printId", printID, "error", err)
		return nil, fmt.Errorf("querying models for print %d: %w", printID, err)
	}
	return models, nil
}

func (s *PrintService) DuplicatePrintModel(printID int64, modelID int64) error {
	tx, err := s.repo.Begin()
	if err != nil {
		slog.Error("failed to begin transaction", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.repo.LinkModelToPrint(tx, printID, modelID); err != nil {
		slog.Error("failed to link model to print", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("linking model %d to print %d: %w", modelID, printID, err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("failed to commit duplicate model transaction", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("committing duplicate model transaction: %w", err)
	}

	slog.Info("model duplicated to print", "printId", printID, "modelId", modelID)
	return nil
}

func computeSHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (s *PrintService) UploadPrintModel(printID int64, fileName string, ext string, size int64, data []byte) error {
	hash := computeSHA256(data)
	now := time.Now()

	tx, err := s.repo.Begin()
	if err != nil {
		slog.Error("failed to begin transaction", "printId", printID, "error", err)
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	// Reuse existing model if hash matches
	existingID, err := s.repo.FindModelByHash(tx, hash)
	if err == nil && existingID > 0 {
		if err := s.repo.LinkModelToPrint(tx, printID, existingID); err != nil {
			slog.Error("failed to link existing model to print", "printId", printID, "modelId", existingID, "error", err)
			return fmt.Errorf("linking existing model %d to print %d: %w", existingID, printID, err)
		}
		if err := tx.Commit(); err != nil {
			slog.Error("failed to commit upload transaction", "printId", printID, "error", err)
			return fmt.Errorf("committing upload transaction: %w", err)
		}
		slog.Info("existing model linked to print", "printId", printID, "modelId", existingID)
		return nil
	}

	modelID, err := s.repo.InsertModel(tx, fileName, ext, hash, size, now)
	if err != nil {
		slog.Error("failed to insert model record", "printId", printID, "error", err)
		return fmt.Errorf("inserting model record: %w", err)
	}

	if err := s.repo.LinkModelToPrint(tx, printID, modelID); err != nil {
		slog.Error("failed to link model to print", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("linking model %d to print %d: %w", modelID, printID, err)
	}

	absPath := filepath.Join(s.modelsDir, fmt.Sprintf("%d_%s.%s", modelID, fileName, ext))

	// The file is written before the transaction commits intentionally -
	// This means if the commit fails, we attempt to clean up the file below
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		slog.Error("failed to write model file", "modelId", modelID, "path", absPath, "error", err)
		return fmt.Errorf("writing model file: %w", err)
	}

	if err := tx.Commit(); err != nil {
		os.Remove(absPath)
		slog.Error("failed to commit upload transaction", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("committing upload transaction: %w", err)
	}

	slog.Info("model uploaded", "printId", printID, "modelId", modelID, "name", fileName)
	return nil
}

func (s *PrintService) DeletePrintModel(printID int64, modelID int64) error {
	tx, err := s.repo.Begin()
	if err != nil {
		slog.Error("failed to begin transaction", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.repo.UnlinkModelFromPrint(tx, printID, modelID); err != nil {
		slog.Error("failed to unlink model from print", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("unlinking model %d from print %d: %w", modelID, printID, err)
	}

	modelExt, modelName, err := s.repo.DeleteModelIfOrphaned(tx, modelID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		slog.Error("failed to delete orphaned model", "modelId", modelID, "error", err)
		return fmt.Errorf("failed to delete orphaned model %d: %w", modelID, err)
	}

	if err := tx.Commit(); err != nil {
		slog.Error("failed to commit delete model transaction", "printId", printID, "modelId", modelID, "error", err)
		return fmt.Errorf("committing delete transaction: %w", err)
	}

	if modelExt != "" {
		absPath := filepath.Join(s.modelsDir, fmt.Sprintf("%d_%s.%s", modelID, modelName, modelExt))
		if err := os.Remove(absPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			slog.Error("failed to remove model file", "modelId", modelID, "path", absPath, "error", err)
		}
	}

	slog.Info("model unlinked from print", "printId", printID, "modelId", modelID)
	return nil
}

func (s *PrintService) QueryPrints(params PrintQueryParams) (*PrintQueryResult, error) {
	if params.SortBy == "" {
		params.SortBy = "created_at"
	}
	if params.SortOrder == "" {
		params.SortOrder = "DESC"
	}
	if params.Limit <= 0 {
		params.Limit = 15
	}

	// Validate sort inputs here - this is business logic, not data access.
	if !validPrintSortColumns[params.SortBy] {
		params.SortBy = "created_at"
	}
	params.SortOrder = strings.ToUpper(params.SortOrder)
	if params.SortOrder != "ASC" && params.SortOrder != "DESC" {
		params.SortOrder = "DESC"
	}

	result, err := s.repo.QueryPrints(params)
	if err != nil {
		slog.Error("failed to query prints", "error", err)
		return nil, err
	}
	return result, nil
}

func (s *PrintService) ViewPrintModel(id int64, name string, ext string) error {

	modelPath := fmt.Sprintf("%d_%s.%s", id, name, ext)
	namePath := fmt.Sprintf("%s.%s", name, ext)

	wm := internal.GetWindowManager()
	wm.NewTransientWindow(application.WebviewWindowOptions{
		Title:  fmt.Sprintf("Preview - %s", namePath),
		URL:    fmt.Sprintf("/#/viewer?modelPath=%s", url.QueryEscape(modelPath)),
		Width:  900,
		Height: 700,
	})

	return nil
}

// allowedExecutableRe matches either:
//   - An absolute path: starts with a drive letter (Windows) or "/" (Unix),
//     contains only safe characters, and has no directory traversal.
//   - A bare executable name: only word characters, hyphens, and dots -
//     no path separators at all (resolved via PATH at runtime).
var allowedExecutableRe = regexp.MustCompile(
	`^(?:[A-Za-z]:[/\\]|/)(?:[^/\\:*?"<>|\x00]+[/\\])*[^/\\:*?"<>|\x00]+$` +
		`|^[A-Za-z0-9][A-Za-z0-9._-]*$`,
)

// blockedPatterns catches shell interpreters, script extensions, and common
// injection tokens that should never appear in a trusted app path.
var blockedPatterns = []*regexp.Regexp{
	// Shell metacharacters and injection vectors
	regexp.MustCompile(`[;&|` + "`" + `$<>!]`),
	// Environment-variable expansion: %VAR% or $VAR / ${VAR}
	regexp.MustCompile(`%[^%]+%|\$\{?[A-Za-z_]`),
	// Network / UNC paths
	regexp.MustCompile(`^(\\\\|//)`),
	// Directory traversal
	regexp.MustCompile(`\.\.`),
	// Null byte
	regexp.MustCompile(`\x00`),
	// Script file extensions
	regexp.MustCompile(`(?i)\.(sh|bash|zsh|fish|ps1|psm1|psd1|bat|cmd|vbs|vbe|js|mjs|ts|py|rb|pl|php|lua|tcl|wsf|hta)$`),
	// Script interpreter names as a word token
	regexp.MustCompile(`(?i)\b(bash|sh|zsh|fish|cmd|powershell|pwsh|python\d*|ruby|perl|node|deno|bun|php|lua|tclsh|cscript|wscript)\b`),
}

// validateAppPath returns an error if openAppPath fails any safety rule.
// This is intentionally separate from exec logic so it can be unit-tested
// independently and called before any OS interaction.
func validateAppPath(openAppPath string) error {
	if openAppPath == "" {
		return fmt.Errorf("app path must not be empty")
	}

	// Hard length cap - no legitimate executable path needs more than this.
	const maxLen = 512
	if len(openAppPath) > maxLen {
		return fmt.Errorf("app path exceeds maximum allowed length (%d characters)", maxLen)
	}

	for _, re := range blockedPatterns {
		if re.MatchString(openAppPath) {
			return fmt.Errorf("app path contains a disallowed pattern: %q matched %s", openAppPath, re)
		}
	}

	// .lnk files are a Windows-only special case handled below; exclude them
	// from the strict shape check but still require an absolute path.
	isLnk := strings.HasSuffix(strings.ToLower(openAppPath), ".lnk")
	if !isLnk && !allowedExecutableRe.MatchString(openAppPath) {
		return fmt.Errorf("app path %q is not an absolute path or a bare executable name", openAppPath)
	}

	// For absolute paths (non-bare-name, non-.lnk), verify the file exists
	// and is a regular file - not a symlink, directory, or device node.
	if strings.ContainsAny(openAppPath, `/\`) {
		info, err := os.Lstat(openAppPath)
		if err != nil {
			return fmt.Errorf("app path %q is not accessible: %w", openAppPath, err)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("app path %q must not be a symbolic link", openAppPath)
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("app path %q must be a regular file", openAppPath)
		}
	}

	return nil
}

func (s *PrintService) OpenInApp(id int64, name string, ext string, openAppPath string) error {
	modelName := fmt.Sprintf("%d_%s.%s", id, name, ext)
	// Validate the model name to prevent directory traversal.
	if filepath.Base(modelName) != modelName || strings.ContainsAny(modelName, `/\:`) {
		return fmt.Errorf("invalid model name %q", modelName)
	}

	if err := validateAppPath(openAppPath); err != nil {
		return fmt.Errorf("unsafe app path rejected: %w", err)
	}

	modelPath := filepath.Join(s.modelsDir, modelName)

	// Confirm the resolved model path is still inside modelsDir - a second
	// layer of defence against any traversal that slipped through.
	if !strings.HasPrefix(filepath.Clean(modelPath)+string(filepath.Separator),
		filepath.Clean(s.modelsDir)+string(filepath.Separator)) {
		return fmt.Errorf("model path escapes models directory")
	}

	var cmd *exec.Cmd
	if strings.HasSuffix(strings.ToLower(openAppPath), ".lnk") {
		// .lnk files must be launched via the Windows shell.
		cmd = exec.Command("cmd", "/c", "start", "", openAppPath, modelPath)
	} else {
		cmd = exec.Command(openAppPath, modelPath)
	}

	return cmd.Start()
}

func (s *PrintService) GetModelData(modelPath string) ([]byte, error) {
	data, err := os.ReadFile(filepath.Join(s.modelsDir, modelPath))
	if err != nil {
		slog.Error("failed to resolve models dir", "error", err)
		return nil, fmt.Errorf("resolving models dir: %w", err)
	}

	return data, nil
}

func (s *PrintService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	dir, err := internal.GetModelsDir()
	if err != nil {
		slog.Error("failed to resolve models dir", "error", err)
		return fmt.Errorf("resolving models dir: %w", err)
	}
	s.modelsDir = dir
	slog.Info("Print service started,", "modelsDir", dir)
	return nil
}

func (s *PrintService) ServiceShutdown() error {
	slog.Info("Print service shutting down")
	return nil
}
