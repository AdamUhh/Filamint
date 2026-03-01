package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type PrintSpool struct {
	ID int64 `db:"id" json:"id"`

	PrintID int64 `db:"print_id" json:"printId"`
	SpoolID int64 `db:"spool_id" json:"spoolId"`

	GramsUsed int `db:"grams_used" json:"gramsUsed"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`

	SpoolCode string `db:"spool_code" json:"spoolCode"`
	Vendor    string `db:"vendor" json:"vendor"`
	Material  string `db:"material" json:"material"`
	Color     string `db:"color" json:"color"`
	ColorHex  string `db:"color_hex" json:"colorHex"`
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
	db *sqlx.DB
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

func getModelsDir() (string, error) {
	base, err := getAppDataDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(base, "models")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}

	return dir, nil
}

func (s *PrintService) CreatePrint(p Print) (int64, error) {
	now := time.Now()

	tx, err := s.db.Beginx()
	if err != nil {
		return 0, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO prints (name, status, notes, date_printed, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, p.Name, p.Status, p.Notes, p.DatePrinted, now, now)
	if err != nil {
		return 0, fmt.Errorf("inserting print: %w", err)
	}

	printID, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("getting print id: %w", err)
	}

	for _, ps := range p.Spools {
		_, err := tx.Exec(
			`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			printID, ps.SpoolID, ps.GramsUsed, now, now,
		)
		if err != nil {
			return 0, fmt.Errorf("inserting print_spool for spool %d: %w", ps.SpoolID, err)
		}

		_, err = tx.Exec(
			`UPDATE spools
			 SET used_weight = used_weight + ?,
			     last_used_at = ?,
			     first_used_at = COALESCE(first_used_at, ?),
			     updated_at = ?
			 WHERE id = ?`,
			ps.GramsUsed, now, now, now, ps.SpoolID,
		)
		if err != nil {
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

	_, err := s.db.Exec(`
		UPDATE prints SET
			name = ?,
			status = ?,
			notes = ?,
			date_printed = ?,
			updated_at = ?
		WHERE id = ?
	`, p.Name, p.Status, p.Notes, p.DatePrinted, now, p.ID)
	if err != nil {
		return fmt.Errorf("updating print %d: %w", p.ID, err)
	}

	for _, ps := range p.Spools {
		var oldGrams int
		err := s.db.Get(&oldGrams,
			`SELECT grams_used FROM print_spools WHERE print_id = ? AND spool_id = ?`,
			p.ID, ps.SpoolID)

		if err == nil {
			// Record exists — update and adjust spool weight by delta
			delta := ps.GramsUsed - oldGrams

			if _, err = s.db.Exec(
				`UPDATE print_spools SET grams_used = ?, updated_at = ? WHERE print_id = ? AND spool_id = ?`,
				ps.GramsUsed, now, p.ID, ps.SpoolID,
			); err != nil {
				return fmt.Errorf("updating print_spool for spool %d: %w", ps.SpoolID, err)
			}

			if delta != 0 {
				if _, err = s.db.Exec(
					`UPDATE spools SET used_weight = used_weight + ?, updated_at = ? WHERE id = ?`,
					delta, now, ps.SpoolID,
				); err != nil {
					return fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
				}
			}
		} else {
			// Record doesn't exist — insert and add full weight
			if _, err = s.db.Exec(
				`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?)`,
				p.ID, ps.SpoolID, ps.GramsUsed, now, now,
			); err != nil {
				return fmt.Errorf("inserting print_spool for spool %d: %w", ps.SpoolID, err)
			}

			if _, err = s.db.Exec(
				`UPDATE spools SET used_weight = used_weight + ?, updated_at = ? WHERE id = ?`,
				ps.GramsUsed, now, ps.SpoolID,
			); err != nil {
				return fmt.Errorf("updating spool weight for spool %d: %w", ps.SpoolID, err)
			}
		}
	}

	return nil
}

func (s *PrintService) DeletePrint(id int64, deletePrintSpools bool) error {
	if id == 0 {
		return errors.New("invalid print ID")
	}

	now := time.Now()

	if deletePrintSpools {
		var printSpools []PrintSpool
		if err := s.db.Select(&printSpools,
			`SELECT spool_id, grams_used FROM print_spools WHERE print_id = ?`, id,
		); err != nil {
			return fmt.Errorf("loading print spools for print %d: %w", id, err)
		}

		for _, ps := range printSpools {
			if _, err := s.db.Exec(
				`UPDATE spools SET used_weight = used_weight - ?, updated_at = ? WHERE id = ?`,
				ps.GramsUsed, now, ps.SpoolID,
			); err != nil {
				return fmt.Errorf("reverting spool weight for spool %d: %w", ps.SpoolID, err)
			}
		}
	}

	if _, err := s.db.Exec(`DELETE FROM print_models WHERE print_id = ?`, id); err != nil {
		return fmt.Errorf("deleting print_models for print %d: %w", id, err)
	}

	var orphanedModels []PrintModel
	if err := s.db.Select(&orphanedModels,
		`SELECT id, file_type AS ext FROM models WHERE id NOT IN (SELECT model_id FROM print_models)`,
	); err != nil {
		return fmt.Errorf("finding orphaned models: %w", err)
	}

	modelsDir, err := getModelsDir()
	if err != nil {
		return err
	}

	for _, m := range orphanedModels {
		os.Remove(filepath.Join(modelsDir, fmt.Sprintf("%d.%s", m.ID, m.Ext)))
		if _, err := s.db.Exec(`DELETE FROM models WHERE id = ?`, m.ID); err != nil {
			return fmt.Errorf("deleting orphaned model %d: %w", m.ID, err)
		}
	}

	if _, err := s.db.Exec(`DELETE FROM prints WHERE id = ?`, id); err != nil {
		return fmt.Errorf("deleting print %d: %w", id, err)
	}
	return nil
}

func (s *PrintService) GetPrintModels(printID int64) ([]PrintModel, error) {
	var models []PrintModel
	err := s.db.Select(&models, `
		SELECT m.id, m.name, m.size, m.file_type AS ext
		FROM models m
		INNER JOIN print_models pm ON pm.model_id = m.id
		WHERE pm.print_id = ?
	`, printID)
	if err != nil {
		return nil, fmt.Errorf("querying models for print %d: %w", printID, err)
	}
	return models, nil
}

func (s *PrintService) DuplicatePrintModel(printID int64, modelID int64) (*PrintModel, error) {
	var orig PrintModel
	if err := s.db.Get(&orig,
		`SELECT id, name, file_type AS ext, size FROM models WHERE id = ?`, modelID,
	); err != nil {
		return nil, fmt.Errorf("loading model %d: %w", modelID, err)
	}

	if _, err := s.db.Exec(
		`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID,
	); err != nil {
		return nil, fmt.Errorf("linking model %d to print %d: %w", modelID, printID, err)
	}

	return &PrintModel{ID: orig.ID, Name: orig.Name, Ext: orig.Ext, Size: orig.Size}, nil
}

func (s *PrintService) UploadPrintModel(printID int64, fileName string, ext string, size int64, data []byte) (*PrintModel, error) {
	modelsDir, err := getModelsDir()
	if err != nil {
		return nil, err
	}

	hash := computeSHA256(data)

	// Reuse existing file if identical content already stored
	var existingID int64
	if err := s.db.Get(&existingID, `SELECT id FROM models WHERE file_hash = ?`, hash); err == nil && existingID > 0 {
		if _, err := s.db.Exec(
			`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, existingID,
		); err != nil {
			return nil, fmt.Errorf("linking existing model %d to print %d: %w", existingID, printID, err)
		}
		return &PrintModel{ID: existingID, Name: fileName, Ext: ext, Size: size}, nil
	}

	res, err := s.db.Exec(
		`INSERT INTO models(name, size, file_type, file_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
		fileName, size, ext, hash, time.Now(),
	)
	if err != nil {
		return nil, fmt.Errorf("inserting model record: %w", err)
	}

	modelID, _ := res.LastInsertId()
	absPath := filepath.Join(modelsDir, fmt.Sprintf("%d.%s", modelID, ext))

	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return nil, fmt.Errorf("writing model file: %w", err)
	}

	if _, err := s.db.Exec(
		`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID,
	); err != nil {
		return nil, fmt.Errorf("linking model %d to print %d: %w", modelID, printID, err)
	}

	return &PrintModel{ID: modelID, Name: fileName, Ext: ext, Size: size}, nil
}

func (s *PrintService) DeletePrintModel(printID int64, modelID int64, modelExt string) error {
	if _, err := s.db.Exec(
		`DELETE FROM print_models WHERE print_id = ? AND model_id = ?`, printID, modelID,
	); err != nil {
		return fmt.Errorf("unlinking model %d from print %d: %w", modelID, printID, err)
	}

	var count int
	if err := s.db.Get(&count,
		`SELECT COUNT(*) FROM print_models WHERE model_id = ?`, modelID,
	); err != nil {
		return fmt.Errorf("checking model %d references: %w", modelID, err)
	}

	if count > 0 {
		// Still referenced by other prints — leave file and record intact
		return nil
	}

	if _, err := s.db.Exec(`DELETE FROM models WHERE id = ?`, modelID); err != nil {
		return fmt.Errorf("deleting model record %d: %w", modelID, err)
	}

	modelsDir, err := getModelsDir()
	if err != nil {
		return err
	}

	if modelExt != "" {
		os.Remove(filepath.Join(modelsDir, fmt.Sprintf("%d.%s", modelID, modelExt)))
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
		qualifiers, freeText := parseSearchQuery(params.Search)

		if val, ok := qualifiers["name"]; ok {
			clause, arg := buildQualifierClause("name", val)
			whereClauses = append(whereClauses, clause)
			args = append(args, arg)
		}
		if val, ok := qualifiers["status"]; ok {
			clause, arg := buildQualifierClause("status", val)
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
		fmt.Sprintf("SELECT COUNT(*) FROM prints %s", whereClause), args...,
	); err != nil {
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

	for i := range prints {
		var spools []PrintSpool
		if err := s.db.Select(&spools, `
			SELECT
				ps.id, ps.print_id, ps.spool_id, ps.grams_used, ps.created_at, ps.updated_at,
				s.color, s.color_hex, s.vendor, s.material, s.spool_code
			FROM print_spools ps
			JOIN spools s ON s.id = ps.spool_id
			WHERE ps.print_id = ?
		`, prints[i].ID); err != nil {
			return nil, fmt.Errorf("failed to load spools for print %d: %w", prints[i].ID, err)
		}
		prints[i].Spools = spools
	}

	return &PrintQueryResult{Prints: prints, Total: total}, nil
}
