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
	ID int64 `db:"id" json:"id"`

	Name string `db:"name" json:"name"`

	Status string `db:"status" json:"status"`

	Notes string `db:"notes" json:"notes"`

	DatePrinted *time.Time `db:"date_printed" json:"datePrinted"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`

	Spools []PrintSpool `json:"spools,omitempty"` // join table
	Models []PrintModel `json:"models,omitempty"` // join table

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
	db *Database
}

func NewPrintService(db *Database) *PrintService {
	return &PrintService{db: db}
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

	tx, err := s.db.db.Beginx()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// 1️⃣ Create print
	res, err := tx.Exec(`
		INSERT INTO prints (
			name,
			status,
			notes,
			date_printed,
			created_at,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?)
	`, p.Name, p.Status, p.Notes, p.DatePrinted, now, now)
	if err != nil {
		return 0, err
	}

	printID, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	for _, ps := range p.Spools {
		_, err := tx.Exec(
			`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			printID,
			ps.SpoolID,
			ps.GramsUsed,
			now,
			now,
		)
		if err != nil {
			return 0, err
		}

		_, err = tx.Exec(
			`UPDATE spools 
			 SET used_weight = used_weight + ?,
			     last_used_at = ?,
			     first_used_at = COALESCE(first_used_at, ?),
			     updated_at = ?
			 WHERE id = ?`,
			ps.GramsUsed,
			now,
			now,
			now,
			ps.SpoolID,
		)
		if err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return printID, nil
}

func (s *PrintService) UpdatePrint(p Print) error {
	if p.ID == 0 {
		return errors.New("print ID is required")
	}

	now := time.Now()

	// Update print fields
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
		return err
	}

	// Update each print_spool
	for _, ps := range p.Spools {
		// Get the old grams_used value (if exists)
		var oldGrams int
		err := s.db.Get(&oldGrams,
			`SELECT grams_used FROM print_spools WHERE print_id = ? AND spool_id = ?`,
			p.ID, ps.SpoolID)

		if err == nil {
			// Record exists - update it
			delta := ps.GramsUsed - oldGrams

			_, err = s.db.Exec(
				`UPDATE print_spools SET grams_used = ?, updated_at = ? 
				 WHERE print_id = ? AND spool_id = ?`,
				ps.GramsUsed, now, p.ID, ps.SpoolID)
			if err != nil {
				return err
			}

			// Update spool used_weight by delta
			if delta != 0 {
				_, err = s.db.Exec(
					`UPDATE spools SET used_weight = used_weight + ?, updated_at = ? WHERE id = ?`,
					delta, now, ps.SpoolID)
				if err != nil {
					return err
				}
			}
		} else {
			// Record doesn't exist - insert it
			_, err = s.db.Exec(
				`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?)`,
				p.ID, ps.SpoolID, ps.GramsUsed, now, now)
			if err != nil {
				return err
			}

			// Add to used_weight
			_, err = s.db.Exec(
				`UPDATE spools SET used_weight = used_weight + ?, updated_at = ? WHERE id = ?`,
				ps.GramsUsed, now, ps.SpoolID)
			if err != nil {
				return err
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

	// If deletePrintSpools is true, we need to undo the used_weights
	if deletePrintSpools {
		// Get all print_spools for this print
		var printSpools []PrintSpool
		err := s.db.Select(&printSpools,
			`SELECT spool_id, grams_used FROM print_spools WHERE print_id = ?`,
			id)
		if err != nil {
			return err
		}

		// Revert used_weight for each spool
		for _, ps := range printSpools {
			_, err := s.db.Exec(
				`UPDATE spools 
				 SET used_weight = used_weight - ?,
				     updated_at = ?
				 WHERE id = ?`,
				ps.GramsUsed,
				now,
				ps.SpoolID,
			)
			if err != nil {
				return err
			}
		}
	}

	// Delete print_models links (so orphaned models can be found)
	if _, err := s.db.Exec(`DELETE FROM print_models WHERE print_id = ?`, id); err != nil {
		return err
	}

	// Get models that are now orphaned
	var models []PrintModel
	if err := s.db.Select(&models,
		`SELECT id, file_type AS ext FROM models WHERE id NOT IN (SELECT model_id FROM print_models)`); err != nil {
		return err
	}

	modelsDir, err := getModelsDir()
	if err != nil {
		return err
	}

	// Delete the files and DB rows
	for _, m := range models {
		os.Remove(filepath.Join(modelsDir, fmt.Sprintf("%d.%s", m.ID, m.Ext)))
		if _, err := s.db.Exec(`DELETE FROM models WHERE id = ?`, m.ID); err != nil {
			return err
		}
	}

	// Finally delete the print itself
	_, err = s.db.Exec(`DELETE FROM prints WHERE id = ?`, id)
	return err
}

func (s *PrintService) GetPrintModels(printID int64) ([]PrintModel, error) {
	var models []PrintModel

	err := s.db.Select(&models, `
		SELECT 
			m.id,
			m.name,
			m.size,
			m.file_type AS ext
		FROM models m
		INNER JOIN print_models pm ON pm.model_id = m.id
		WHERE pm.print_id = ?
	`, printID)
	if err != nil {
		return nil, err
	}

	return models, nil
}

func (s *PrintService) DuplicatePrintModel(printID int64, modelID int64) (*PrintModel, error) {
	// 1️⃣ Load original model metadata
	var orig PrintModel
	err := s.db.Get(&orig, `SELECT id, name, file_type as ext, size FROM models WHERE id = ?`, modelID)
	if err != nil {
		return nil, err
	}

	// 2️⃣ Link the existing model to the new print
	_, err = s.db.Exec(`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID)
	if err != nil {
		return nil, err
	}

	// 3️⃣ Return the model info
	return &PrintModel{
		ID:   orig.ID,
		Name: orig.Name,
		Ext:  orig.Ext,
		Size: orig.Size,
	}, nil
}

func (s *PrintService) UploadPrintModel(printID int64, fileName string, ext string, size int64, data []byte) (*PrintModel, error) {

	modelsDir, err := getModelsDir()
	if err != nil {
		return nil, err
	}

	hash := computeSHA256(data)

	// Check if identical file already exists
	var existingID int64
	err = s.db.Get(&existingID, `SELECT id FROM models WHERE file_hash = ?`, hash)
	if err == nil && existingID > 0 {
		// Already exists, link to print
		_, err := s.db.Exec(`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, existingID)
		if err != nil {
			return nil, err
		}
		return &PrintModel{ID: existingID, Name: fileName, Ext: ext, Size: size}, nil
	}

	// Insert new model metadata
	res, err := s.db.Exec(`INSERT INTO models(name, size, file_type, file_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
		fileName, size, ext, hash, time.Now())
	if err != nil {
		return nil, err
	}

	modelID, _ := res.LastInsertId()
	absPath := filepath.Join(modelsDir, fmt.Sprintf("%d.%s", modelID, ext))

	// Save file locally
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return nil, err
	}

	// Link to print
	_, err = s.db.Exec(`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID)
	if err != nil {
		return nil, err
	}

	return &PrintModel{ID: modelID, Name: fileName, Ext: ext, Size: size}, nil
}

// TODO: this is deleting the print model completely... first need to check if other fk print_models exist, then delete model
func (s *PrintService) DeletePrintModel(printID int64, modelID int64, modelExt string) error {
	// 1️⃣ Delete the link from print_models
	_, err := s.db.Exec(`DELETE FROM print_models WHERE print_id = ? AND model_id = ?`, printID, modelID)
	if err != nil {
		return err
	}

	// 2️⃣ Check if any other prints still reference this model
	var count int
	err = s.db.Get(&count, `SELECT COUNT(*) FROM print_models WHERE model_id = ?`, modelID)
	if err != nil {
		return err
	}

	if count > 0 {
		// Still used by other prints, do not delete file or model record
		return nil
	}

	// 4️⃣ Delete model record
	_, err = s.db.Exec(`DELETE FROM models WHERE id = ?`, modelID)
	if err != nil {
		return err
	}

	// 5️⃣ Delete local file
	modelsDir, err := getModelsDir()
	if err != nil {
		return err
	}

	absPath := filepath.Join(modelsDir, fmt.Sprintf("%d.%s", modelID, modelExt))
	if absPath != "" && modelExt != "" {
		os.Remove(absPath)
	}

	return nil
}

// New query method with filtering, sorting, and pagination
func (s *PrintService) QueryPrints(params PrintQueryParams) (*PrintQueryResult, error) {
	// Set defaults
	if params.SortBy == "" {
		params.SortBy = "created_at"
	}
	if params.SortOrder == "" {
		params.SortOrder = "DESC"
	}
	if params.Limit <= 0 {
		params.Limit = 15
	}

	// Build WHERE clause
	var whereClauses []string
	var args []any
	argPosition := 1

	if params.Search != "" {
		qualifiers, freeText := parseSearchQuery(params.Search)

		if val, ok := qualifiers["name"]; ok {
			clause, arg := buildQualifierClause("name", val, argPosition)
			whereClauses = append(whereClauses, clause)
			args = append(args, arg)
			argPosition++
		}
		if val, ok := qualifiers["status"]; ok {
			clause, arg := buildQualifierClause("status", val, argPosition)
			whereClauses = append(whereClauses, clause)
			args = append(args, arg)
			argPosition++
		}

		if val, ok := qualifiers["spool"]; ok {
			if strings.Contains(val, "*") {
				likeVal := strings.ReplaceAll(val, "*", "%")
				whereClauses = append(whereClauses, fmt.Sprintf(
					`id IN (SELECT print_id FROM print_spools WHERE spool_id IN (SELECT id FROM spools WHERE LOWER(spool_code) LIKE ?%d))`,
					argPosition,
				))
				args = append(args, likeVal)
			} else {
				whereClauses = append(whereClauses, fmt.Sprintf(
					`id IN (SELECT print_id FROM print_spools WHERE spool_id IN (SELECT id FROM spools WHERE LOWER(spool_code) = ?%d))`,
					argPosition,
				))
				args = append(args, val)
			}
			argPosition++
		}

		if freeText != "" {
			searchPattern := "%" + strings.ToLower(freeText) + "%"
			whereClauses = append(whereClauses, fmt.Sprintf(
				"(LOWER(name) LIKE ?%d OR LOWER(notes) LIKE ?%d)",
				argPosition, argPosition+1,
			))
			args = append(args, searchPattern, searchPattern)
			argPosition += 2
		}
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Validate and sanitize sort column
	validSortColumns := map[string]bool{
		"id":           true,
		"name":         true,
		"status":       true,
		"date_printed": true,
		"created_at":   true,
		"updated_at":   true,
	}

	sortColumn := params.SortBy
	if !validSortColumns[sortColumn] {
		sortColumn = "created_at"
	}

	sortOrder := strings.ToUpper(params.SortOrder)
	if sortOrder != "ASC" && sortOrder != "DESC" {
		sortOrder = "DESC"
	}

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM prints %s", whereClause)
	var total int
	err := s.db.Get(&total, countQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to count prints: %w", err)
	}

	// Get paginated results
	query := fmt.Sprintf(
		"SELECT * FROM prints %s ORDER BY %s %s LIMIT ?%d OFFSET ?%d",
		whereClause,
		sortColumn,
		sortOrder,
		argPosition,
		argPosition+1,
	)
	args = append(args, params.Limit, params.Offset)

	var prints []Print
	err = s.db.Select(&prints, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query prints: %w", err)
	}

	// Load spools for each print
	for i := range prints {
		var spools []PrintSpool

		err := s.db.Select(&spools, `
		SELECT 
			ps.id,
			ps.print_id,
			ps.spool_id,
			ps.grams_used,
			ps.created_at,
			ps.updated_at,
			s.color,
			s.color_hex,
			s.vendor,
			s.material,
			s.spool_code
		FROM print_spools ps
		JOIN spools s ON s.id = ps.spool_id
		WHERE ps.print_id = ?
	`, prints[i].ID)

		if err != nil {
			return nil, fmt.Errorf("failed to load spools: %w", err)
		}

		prints[i].Spools = spools
	}

	return &PrintQueryResult{
		Prints: prints,
		Total:  total,
	}, nil
}
