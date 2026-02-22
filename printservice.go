package main

import (
	"errors"
	"fmt"
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

	Spool *Spool `json:"spool,omitempty"`
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

func (s *PrintService) CreatePrint(p Print) (int64, error) {
	now := time.Now()

	// Insert the print first
	query := `
	INSERT INTO prints (
		name,
		status,
		notes,
		date_printed,
		created_at,
		updated_at
	) VALUES (?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.Exec(
		query,
		p.Name,
		p.Status,
		p.Notes,
		p.DatePrinted,
		now,
		now,
	)
	if err != nil {
		return 0, err
	}

	printID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	// Insert related spools in print_spools and update used_weight
	for _, ps := range p.Spools {
		// Insert print_spool record
		_, err := s.db.Exec(
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

		// Update the spool's used_weight
		_, err = s.db.Exec(
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

	// Delete the print (CASCADE will delete print_spools automatically)
	_, err := s.db.Exec(`DELETE FROM prints WHERE id = ?`, id)
	return err
}

func (s *PrintService) GetPrint(id int64) (*Print, error) {
	var p Print

	err := s.db.Get(&p, `SELECT * FROM prints WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}

	// Load associated spools
	var spools []PrintSpool
	err = s.db.Select(&spools, `SELECT * FROM print_spools WHERE print_id = ?`, id)
	if err != nil {
		return nil, err
	}

	p.Spools = spools
	return &p, nil
}

// Legacy method - kept for backward compatibility
func (s *PrintService) ListPrints() ([]Print, error) {
	var prints []Print
	err := s.db.Select(&prints, `SELECT * FROM prints ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}

	// Load spools for each print
	for i := range prints {
		var spools []PrintSpool
		err := s.db.Select(&spools, `SELECT * FROM print_spools WHERE print_id = ?`, prints[i].ID)
		if err != nil {
			return nil, err
		}
		prints[i].Spools = spools
	}

	return prints, nil
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
			whereClauses = append(whereClauses, fmt.Sprintf("LOWER(name) = ?%d", argPosition))
			args = append(args, val)
			argPosition++
		}

		if val, ok := qualifiers["status"]; ok {
			whereClauses = append(whereClauses, fmt.Sprintf("LOWER(status) = ?%d", argPosition))
			args = append(args, val)
			argPosition++
		}

		if val, ok := qualifiers["spool"]; ok {
			whereClauses = append(whereClauses, fmt.Sprintf(
				`id IN (SELECT print_id FROM print_spools WHERE spool_id IN (SELECT id FROM spools WHERE LOWER(spool_code) = ?%d))`,
				argPosition,
			))
			args = append(args, val)
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
		err := s.db.Select(&spools, `SELECT * FROM print_spools WHERE print_id = ?`, prints[i].ID)
		if err != nil {
			return nil, err
		}
		prints[i].Spools = spools
	}

	return &PrintQueryResult{
		Prints: prints,
		Total:  total,
	}, nil
}
