package services

import (
	internal "changeme/internal"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

// qualifierColumns maps search qualifier keys to their DB column names.
var qualifierColumns = map[string]string{
	"spool":    "spool_code",
	"material": "material",
	"vendor":   "vendor",
	"color":    "color",
}

// validSortColumns is the allowlist for ORDER BY to prevent SQL injection.
var validSortColumns = map[string]bool{
	"id":            true,
	"spool_code":    true,
	"vendor":        true,
	"material":      true,
	"material_type": true,
	"color":         true,
	"total_weight":  true,
	"used_weight":   true,
	"cost":          true,
	"created_at":    true,
	"updated_at":    true,
}

type SpoolRepository struct {
	db *sqlx.DB
}

func NewSpoolRepository(db *sqlx.DB) *SpoolRepository {
	return &SpoolRepository{db: db}
}

func (r *SpoolRepository) Insert(spool Spool, code string) (int64, error) {
	result, err := r.db.Exec(`
		INSERT INTO spools (
			spool_code,
			vendor, material, material_type, color, color_hex,
			total_weight, used_weight,
			cost, reference_link, notes, is_template,
			first_used_at, last_used_at,
			created_at, updated_at
		) VALUES (
			?, ?, ?, ?, ?, ?,
			?, ?,
			?, ?, ?, ?,
			?, ?,
			?, ?
		)
	`,
		code,
		spool.Vendor,
		spool.Material,
		spool.MaterialType,
		spool.Color,
		spool.ColorHex,
		spool.TotalWeight,
		spool.UsedWeight,
		spool.Cost,
		spool.ReferenceLink,
		spool.Notes,
		internal.ConvertBoolToInt(spool.IsTemplate),
		spool.FirstUsedAt,
		spool.LastUsedAt,
		spool.CreatedAt,
		spool.UpdatedAt,
	)
	if err != nil {
		return 0, err // return raw so service can inspect for UNIQUE constraint
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("getting spool id: %w", err)
	}

	return id, nil
}

func (r *SpoolRepository) Update(spool Spool) error {
	_, err := r.db.Exec(`
		UPDATE spools SET
			vendor = ?,
			material = ?,
			material_type = ?,
			color = ?,
			color_hex = ?,
			total_weight = ?,
			used_weight = ?,
			cost = ?,
			reference_link = ?,
			notes = ?,
			is_template = ?,
			first_used_at = ?,
			last_used_at = ?,
			updated_at = ?
		WHERE id = ?
	`,
		spool.Vendor,
		spool.Material,
		spool.MaterialType,
		spool.Color,
		spool.ColorHex,
		spool.TotalWeight,
		spool.UsedWeight,
		spool.Cost,
		spool.ReferenceLink,
		spool.Notes,
		internal.ConvertBoolToInt(spool.IsTemplate),
		spool.FirstUsedAt,
		spool.LastUsedAt,
		spool.UpdatedAt,
		spool.ID,
	)
	if err != nil {
		return fmt.Errorf("updating spool %d: %w", spool.ID, err)
	}
	return nil
}

func (r *SpoolRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM spools WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting spool %d: %w", id, err)
	}
	return nil
}

func (r *SpoolRepository) GetPrints(spoolID int64) ([]SpoolPrint, error) {
	var prints []SpoolPrint
	err := r.db.Select(&prints, `
		SELECT
		    p.id AS print_id,
		    p.name AS print_name,
		    ps.grams_used
		FROM print_spools ps
		JOIN prints p ON p.id = ps.print_id
		WHERE ps.spool_id = ?
		ORDER BY p.date_printed DESC
	`, spoolID)
	if err != nil {
		return nil, fmt.Errorf("querying prints for spool %d: %w", spoolID, err)
	}
	return prints, nil
}

func (r *SpoolRepository) GetSpool(spoolID int64) (*Spool, error) {
	var spool Spool
	err := r.db.Get(&spool, `
	    SELECT * FROM spools WHERE id = ?
	`, spoolID)
	if err != nil {
		return nil, fmt.Errorf("fetching spool id %d: %w", spoolID, err)
	}
	return &spool, nil
}

func (r *SpoolRepository) Query(params SpoolQueryParams) (*SpoolQueryResult, error) {
	var whereClauses []string
	var args []any

	if params.Search != "" {
		qualifiers, freeText := internal.ParseSearchQuery(params.Search)

		for qualifier, column := range qualifierColumns {
			if val, ok := qualifiers[qualifier]; ok {
				clause, arg := internal.BuildQualifierClause(column, val)
				whereClauses = append(whereClauses, clause)
				args = append(args, arg)
			}
		}

		if freeText != "" {
			searchPattern := "%" + strings.ToLower(freeText) + "%"
			whereClauses = append(whereClauses, "(LOWER(spool_code) LIKE ? OR LOWER(vendor) LIKE ? OR LOWER(material) LIKE ? OR LOWER(color) LIKE ?)")
			args = append(args, searchPattern, searchPattern, searchPattern, searchPattern)
		}
	}

	if params.IsTemplate != nil {
		whereClauses = append(whereClauses, "is_template = ?")
		args = append(args, internal.ConvertBoolToInt(*params.IsTemplate))
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	sortColumn := params.SortBy
	if !validSortColumns[sortColumn] {
		sortColumn = "updated_at"
	}
	sortOrder := strings.ToUpper(params.SortOrder)
	if sortOrder != "ASC" && sortOrder != "DESC" {
		sortOrder = "DESC"
	}

	var total int
	if err := r.db.Get(&total, fmt.Sprintf("SELECT COUNT(*) FROM spools %s", whereClause), args...); err != nil {
		return nil, fmt.Errorf("counting spools: %w", err)
	}

	query := fmt.Sprintf(
		"SELECT * FROM spools %s ORDER BY %s %s LIMIT ? OFFSET ?",
		whereClause, sortColumn, sortOrder,
	)
	args = append(args, params.Limit, params.Offset)

	var spools []Spool
	if err := r.db.Select(&spools, query, args...); err != nil {
		return nil, fmt.Errorf("querying spools: %w", err)
	}

	return &SpoolQueryResult{Spools: spools, Total: total}, nil
}
