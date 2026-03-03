package services

import (
	internal "changeme/internal"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Spool struct {
	ID        int64  `db:"id" json:"id"`
	SpoolCode string `db:"spool_code" json:"spoolCode"`

	Vendor       string `db:"vendor" json:"vendor"`
	Material     string `db:"material" json:"material"`
	MaterialType string `db:"material_type" json:"materialType"`
	Color        string `db:"color" json:"color"`
	ColorHex     string `db:"color_hex" json:"colorHex"`

	TotalWeight   int    `db:"total_weight" json:"totalWeight"`
	UsedWeight    int    `db:"used_weight" json:"usedWeight"`
	Cost          int    `db:"cost" json:"cost"`
	ReferenceLink string `db:"reference_link" json:"referenceLink"`
	Notes         string `db:"notes" json:"notes"`
	IsTemplate    bool   `db:"is_template" json:"isTemplate"`

	FirstUsedAt *time.Time `db:"first_used_at" json:"firstUsedAt"`
	LastUsedAt  *time.Time `db:"last_used_at" json:"lastUsedAt"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

type SpoolQueryParams struct {
	Search     string `json:"search"`
	IsTemplate *bool  `json:"isTemplate"`
	SortBy     string `json:"sortBy"`
	SortOrder  string `json:"sortOrder"`
	Limit      int    `json:"limit"`
	Offset     int    `json:"offset"`
}

type SpoolQueryResult struct {
	Spools []Spool `json:"spools"`
	Total  int     `json:"total"`
}

type SpoolPrint struct {
	PrintID   int64  `db:"print_id" json:"printId"`
	PrintName string `db:"print_name" json:"printName"`
	GramsUsed int    `db:"grams_used" json:"gramsUsed"`
}

type SpoolService struct {
	db *sqlx.DB
}

// qualifierColumns maps search qualifier keys to their DB column names.
// Defined at package level since it's constant.
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

func validateSpool(spool Spool) error {
	if strings.TrimSpace(spool.Material) == "" {
		return fmt.Errorf("material is required")
	}
	if strings.TrimSpace(spool.Color) == "" {
		return fmt.Errorf("color is required")
	}
	if spool.TotalWeight <= 0 {
		return fmt.Errorf("total_weight must be > 0")
	}
	if spool.UsedWeight < 0 {
		return fmt.Errorf("used_weight cannot be negative")
	}
	if spool.UsedWeight > spool.TotalWeight {
		return fmt.Errorf("used_weight cannot exceed total_weight")
	}
	if spool.Cost < 0 {
		return fmt.Errorf("cost cannot be negative")
	}
	return nil
}

func NewSpoolService(database *Database) *SpoolService {
	return &SpoolService{db: database.db}
}

func (s *SpoolService) CreateSpool(spool Spool) (int64, error) {
	if err := validateSpool(spool); err != nil {
		return 0, err
	}

	now := time.Now()

	const maxAttempts = 5

	for range maxAttempts {
		code, err := internal.GenerateSpoolCodeBase(spool.Material, spool.Color)
		if err != nil {
			return 0, fmt.Errorf("generating spool code: %w", err)
		}

		result, err := s.db.Exec(`
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
			now,
			now,
		)

		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				// spool code is taken
				continue // retry with new code
			}
			return 0, fmt.Errorf("inserting spool: %w", err)
		}

		id, err := result.LastInsertId()
		if err != nil {
			return 0, fmt.Errorf("getting spool id: %w", err)
		}

		return id, nil
	}

	return 0, fmt.Errorf("failed to generate unique spool code after retries")
}

func (s *SpoolService) UpdateSpool(spool Spool) error {
	if spool.ID == 0 {
		return fmt.Errorf("spool id is required")
	}
	if err := validateSpool(spool); err != nil {
		return err
	}

	query := `
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
	`

	_, err := s.db.Exec(
		query,
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
		time.Now(),
		spool.ID,
	)

	if err != nil {
		return fmt.Errorf("updating spool %d: %w", spool.ID, err)
	}

	return nil
}

func (s *SpoolService) DeleteSpool(id int64) error {
	if id == 0 {
		return fmt.Errorf("invalid spool id")
	}

	_, err := s.db.Exec(`DELETE FROM spools WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting spool %d: %w", id, err)
	}
	return nil
}

func (s *SpoolService) GetSpoolPrints(spoolID int64) ([]SpoolPrint, error) {
	var prints []SpoolPrint

	query := `
		SELECT
		    p.id AS print_id,
		    p.name AS print_name,
		    ps.grams_used
		FROM print_spools ps
		JOIN prints p ON p.id = ps.print_id
		WHERE ps.spool_id = ?
		ORDER BY p.date_printed DESC
	`

	err := s.db.Select(&prints, query, spoolID)
	if err != nil {
		return nil, fmt.Errorf("querying prints for spool %d: %w", spoolID, err)
	}

	return prints, nil
}

func (s *SpoolService) QuerySpools(params SpoolQueryParams) (*SpoolQueryResult, error) {
	if params.SortBy == "" {
		params.SortBy = "updated_at"
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

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM spools %s", whereClause)
	var total int
	if err := s.db.Get(&total, countQuery, args...); err != nil {
		return nil, fmt.Errorf("failed to count spools: %w", err)
	}

	query := fmt.Sprintf(
		"SELECT * FROM spools %s ORDER BY %s %s LIMIT ? OFFSET ?",
		whereClause, sortColumn, sortOrder,
	)
	args = append(args, params.Limit, params.Offset)

	var spools []Spool
	if err := s.db.Select(&spools, query, args...); err != nil {
		return nil, fmt.Errorf("failed to query spools: %w", err)
	}

	return &SpoolQueryResult{
		Spools: spools,
		Total:  total,
	}, nil
}

func (s *SpoolService) ServiceShutdown() error { return nil }
