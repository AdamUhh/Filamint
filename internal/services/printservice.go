package services

import (
	internal "changeme/internal"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
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
	Data []byte `db:"data" json:"data"`
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
	db        *sqlx.DB
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
	return &PrintService{db: database.db}
}

func computeSHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (s *PrintService) CreatePrint(p Print) (int64, error) {
	now := time.Now()

	tx, err := s.db.Beginx()
	if err != nil {
		return 0, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`INSERT INTO prints (name, status, notes, date_printed, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		p.Name, p.Status, p.Notes, p.DatePrinted, now, now)
	if err != nil {
		return 0, fmt.Errorf("inserting print: %w", err)
	}

	printID, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("getting print id: %w", err)
	}

	for _, ps := range p.Spools {
		if _, err := tx.Exec(
			`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			printID, ps.SpoolID, ps.GramsUsed, now, now,
		); err != nil {
			return 0, fmt.Errorf("inserting print_spool for spool %d: %w", ps.SpoolID, err)
		}

		if _, err = tx.Exec(
			`UPDATE spools
			 SET used_weight = used_weight + ?,
			     last_used_at = ?,
			     first_used_at = COALESCE(first_used_at, ?),
			     updated_at = ?
			 WHERE id = ?`,
			ps.GramsUsed, now, now, now, ps.SpoolID,
		); err != nil {
			return 0, fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("committing transaction: %w", err)
	}

	return printID, nil
}

func (s *PrintService) UpdatePrint(p Print) error {
	if p.ID == 0 {
		return errors.New("print ID is required")
	}

	now := time.Now()

	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`UPDATE prints
		SET name = ?, status = ?, notes = ?, date_printed = ?, updated_at = ? WHERE id = ?`,
		p.Name, p.Status, p.Notes, p.DatePrinted, now, p.ID,
	); err != nil {
		return fmt.Errorf("updating print %d: %w", p.ID, err)
	}

	var existingSpools []PrintSpool
	if err := tx.Select(&existingSpools,
		`SELECT spool_id, grams_used FROM print_spools 
		WHERE print_id = ?`,
		p.ID,
	); err != nil {
		return fmt.Errorf("loading existing spools for print %d: %w", p.ID, err)
	}

	existingMap := make(map[int64]int, len(existingSpools))
	for _, es := range existingSpools {
		existingMap[es.SpoolID] = es.GramsUsed
	}

	incomingMap := make(map[int64]bool, len(p.Spools))
	for _, ps := range p.Spools {
		incomingMap[ps.SpoolID] = true
	}

	// Revert weight and remove row for any spools no longer in the update
	for _, es := range existingSpools {
		if !incomingMap[es.SpoolID] {
			if _, err := tx.Exec(
				`UPDATE spools SET used_weight = used_weight - ?, updated_at = ? WHERE id = ?`,
				es.GramsUsed, now, es.SpoolID,
			); err != nil {
				return fmt.Errorf("reverting spool weight for removed spool %d: %w", es.SpoolID, err)
			}
			if _, err := tx.Exec(
				`DELETE FROM print_spools WHERE print_id = ? AND spool_id = ?`, p.ID, es.SpoolID,
			); err != nil {
				return fmt.Errorf("removing print_spool for spool %d: %w", es.SpoolID, err)
			}
		}
	}

	// Upsert incoming spools
	for _, ps := range p.Spools {
		if oldGrams, exists := existingMap[ps.SpoolID]; exists {
			delta := ps.GramsUsed - oldGrams
			if _, err := tx.Exec(
				`UPDATE print_spools SET grams_used = ?, updated_at = ? WHERE print_id = ? AND spool_id = ?`,
				ps.GramsUsed, now, p.ID, ps.SpoolID,
			); err != nil {
				return fmt.Errorf("updating print_spool for spool %d: %w", ps.SpoolID, err)
			}
			if delta != 0 {
				if _, err := tx.Exec(
					`UPDATE spools SET used_weight = used_weight + ?, updated_at = ? WHERE id = ?`,
					delta, now, ps.SpoolID,
				); err != nil {
					return fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
				}
			}
		} else {
			if _, err := tx.Exec(
				`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
				p.ID, ps.SpoolID, ps.GramsUsed, now, now,
			); err != nil {
				return fmt.Errorf("inserting print_spool for spool %d: %w", ps.SpoolID, err)
			}
			if _, err := tx.Exec(
				`UPDATE spools SET used_weight = used_weight + ?, updated_at = ? WHERE id = ?`,
				ps.GramsUsed, now, ps.SpoolID,
			); err != nil {
				return fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing print update transaction: %w", err)
	}

	return nil
}

func (s *PrintService) DeletePrint(id int64, restoreSpoolGrams bool) error {
	if id == 0 {
		return errors.New("invalid print ID")
	}

	now := time.Now()

	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if restoreSpoolGrams {
		var printSpools []PrintSpool
		if err := tx.Select(&printSpools,
			`SELECT spool_id, grams_used FROM print_spools WHERE print_id = ?`, id,
		); err != nil {
			return fmt.Errorf("loading print spools for print %d: %w", id, err)
		}

		for _, ps := range printSpools {
			if _, err := tx.Exec(
				`UPDATE spools SET used_weight = used_weight - ?, updated_at = ? WHERE id = ?`,
				ps.GramsUsed, now, ps.SpoolID,
			); err != nil {
				return fmt.Errorf("reverting spool weight for spool %d: %w", ps.SpoolID, err)
			}
		}
	}

	var modelIDs []int64
	if err := tx.Select(&modelIDs,
		`SELECT model_id FROM print_models WHERE print_id = ?`, id,
	); err != nil {
		return fmt.Errorf("loading model ids for print %d: %w", id, err)
	}

	if _, err := tx.Exec(`DELETE FROM print_models WHERE print_id = ?`, id); err != nil {
		return fmt.Errorf("deleting print_models for print %d: %w", id, err)
	}

	if len(modelIDs) > 0 {
		orphanQuery, orphanArgs, err := sqlx.In(
			`SELECT id, file_type AS ext FROM models WHERE id IN (?) AND id NOT IN (SELECT model_id FROM print_models)`,
			modelIDs,
		)
		if err != nil {
			return fmt.Errorf("building orphan query: %w", err)
		}

		var orphanedModels []PrintModel
		if err := tx.Select(&orphanedModels, s.db.Rebind(orphanQuery), orphanArgs...); err != nil {
			return fmt.Errorf("finding orphaned models: %w", err)
		}

		for _, m := range orphanedModels {
			filePath := filepath.Join(s.modelsDir, fmt.Sprintf("%d.%s", m.ID, m.Ext))
			if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("deleting model file %s: %w", filePath, err)
			}
			if _, err := tx.Exec(`DELETE FROM models WHERE id = ?`, m.ID); err != nil {
				return fmt.Errorf("deleting orphaned model %d: %w", m.ID, err)
			}
		}
	}

	if _, err := tx.Exec(`DELETE FROM prints WHERE id = ?`, id); err != nil {
		return fmt.Errorf("deleting print %d: %w", id, err)
	}

	return tx.Commit()
}

func (s *PrintService) GetPrintModels(printID int64) ([]PrintModel, error) {
	var models []PrintModel
	err := s.db.Select(&models, `
		SELECT m.id, m.name, m.size, m.ext
		FROM models m
		INNER JOIN print_models pm ON pm.model_id = m.id
		WHERE pm.print_id = ?`, printID)
	if err != nil {
		return nil, fmt.Errorf("querying models for print %d: %w", printID, err)
	}
	return models, nil
}

func (s *PrintService) DuplicatePrintModel(printID int64, modelID int64) error {
	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID,
	); err != nil {
		return fmt.Errorf("linking model %d to print %d: %w", modelID, printID, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing duplicate model transaction: %w", err)
	}

	return nil
}

func (s *PrintService) UploadPrintModel(printID int64, fileName string, ext string, size int64, data []byte) error {
	hash := computeSHA256(data)

	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	// check if model exists via hash
	var existingModelID int64
	if err := tx.Get(&existingModelID, `SELECT id FROM models WHERE hash = ?`, hash); err == nil && existingModelID > 0 {
		if _, err := tx.Exec(
			`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, existingModelID,
		); err != nil {
			return fmt.Errorf("linking existing model %d to print %d: %w", existingModelID, printID, err)
		}
		return tx.Commit()
	}

	// Upload new model to filesystem and model db
	res, err := tx.Exec(
		`INSERT INTO models(name, size, ext, hash, created_at) VALUES (?, ?, ?, ?, ?)`,
		fileName, size, ext, hash, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("inserting model record: %w", err)
	}

	modelID, err := res.LastInsertId()
	if err != nil {
		return fmt.Errorf("getting model id: %w", err)
	}

	absPath := filepath.Join(s.modelsDir, fmt.Sprintf("%d.%s", modelID, ext))
	if _, err := tx.Exec(
		`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID,
	); err != nil {
		return fmt.Errorf("linking model %d to print %d: %w", modelID, printID, err)
	}

	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return fmt.Errorf("writing model file: %w", err)
	}

	if err := tx.Commit(); err != nil {
		os.Remove(absPath)
		return fmt.Errorf("committing upload transaction: %w", err)
	}

	return nil
}

func (s *PrintService) DeletePrintModel(printID int64, modelID int64) error {
	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	// Unlink
	if _, err := tx.Exec(
		`DELETE FROM print_models WHERE print_id = ? AND model_id = ?`,
		printID, modelID,
	); err != nil {
		return fmt.Errorf("unlinking model %d from print %d: %w", modelID, printID, err)
	}

	// Delete only if no more references
	var modelExt string
	err = tx.Get(&modelExt, `
		DELETE FROM models
		WHERE id = ?
		AND NOT EXISTS (
			SELECT 1 FROM print_models WHERE model_id = ?
		)
		RETURNING ext
	`, modelID, modelID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("cannot find model %d: %w", modelID, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing delete transaction: %w", err)
	}

	if modelExt != "" {
		absPath := filepath.Join(s.modelsDir, fmt.Sprintf("%d.%s", modelID, modelExt))
		if err := os.Remove(absPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			fmt.Printf("failed to remove model file modelID=%d path=%s err=%v\n", modelID, absPath, err)
		}
	}

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

	var whereClauses []string
	var args []any

	if params.Search != "" {
		qualifiers, freeText := internal.ParseSearchQuery(params.Search)

		if val, ok := qualifiers["name"]; ok {
			clause, arg := internal.BuildQualifierClause("name", val)
			whereClauses = append(whereClauses, clause)
			args = append(args, arg)
		}
		if val, ok := qualifiers["status"]; ok {
			clause, arg := internal.BuildQualifierClause("status", val)
			whereClauses = append(whereClauses, clause)
			args = append(args, arg)
		}

		if val, ok := qualifiers["spool"]; ok {
			subquery := `id IN (SELECT print_id FROM print_spools WHERE spool_id IN (SELECT id FROM spools WHERE LOWER(spool_code) = ?))`
			arg := any(val)
			if strings.Contains(val, "*") {
				subquery = `id IN (SELECT print_id FROM print_spools WHERE spool_id IN (SELECT id FROM spools WHERE LOWER(spool_code) LIKE ?))`
				arg = strings.ReplaceAll(val, "*", "%")
			}
			whereClauses = append(whereClauses, subquery)
			args = append(args, arg)
		}

		if freeText != "" {
			searchPattern := "%" + strings.ToLower(freeText) + "%"
			whereClauses = append(whereClauses, "(LOWER(name) LIKE ? OR LOWER(notes) LIKE ?)")
			args = append(args, searchPattern, searchPattern)
		}
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	sortColumn := params.SortBy
	if !validPrintSortColumns[sortColumn] {
		sortColumn = "created_at"
	}
	sortOrder := strings.ToUpper(params.SortOrder)
	if sortOrder != "ASC" && sortOrder != "DESC" {
		sortOrder = "DESC"
	}

	var total int
	if err := s.db.Get(&total,
		fmt.Sprintf("SELECT COUNT(*) FROM prints %s", whereClause), args...); err != nil {
		return nil, fmt.Errorf("failed to count prints: %w", err)
	}

	query := fmt.Sprintf(
		"SELECT * FROM prints %s ORDER BY %s %s LIMIT ? OFFSET ?",
		whereClause, sortColumn, sortOrder,
	)
	args = append(args, params.Limit, params.Offset)

	var prints []Print
	if err := s.db.Select(&prints, query, args...); err != nil {
		return nil, fmt.Errorf("failed to query prints: %w", err)
	}

	if len(prints) == 0 {
		return &PrintQueryResult{Prints: prints, Total: total}, nil
	}

	ids := make([]int64, len(prints))
	for i, p := range prints {
		ids[i] = p.ID
	}

	spoolQuery, spoolArgs, err := sqlx.In(`
		SELECT
			ps.id, ps.print_id, ps.spool_id, ps.grams_used, ps.created_at, ps.updated_at,
			s.color, s.color_hex, s.vendor, s.material, s.spool_code, s.total_weight, s.used_weight
		FROM print_spools ps
		JOIN spools s ON s.id = ps.spool_id
		WHERE ps.print_id IN (?)
	`, ids)
	if err != nil {
		return nil, fmt.Errorf("building spool query: %w", err)
	}

	var allSpools []PrintSpool
	if err := s.db.Select(&allSpools, s.db.Rebind(spoolQuery), spoolArgs...); err != nil {
		return nil, fmt.Errorf("loading spools for prints: %w", err)
	}

	spoolMap := make(map[int64][]PrintSpool, len(prints))
	for _, sp := range allSpools {
		spoolMap[sp.PrintID] = append(spoolMap[sp.PrintID], sp)
	}
	for i := range prints {
		prints[i].Spools = spoolMap[prints[i].ID]
	}

	return &PrintQueryResult{Prints: prints, Total: total}, nil
}

func (s *PrintService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	dir, err := internal.GetModelsDir()
	if err != nil {
		return fmt.Errorf("resolving models dir: %w", err)
	}

	s.modelsDir = dir
	return nil
}

func (s *PrintService) ServiceShutdown() error { return nil }
