package main

import (
	"crypto/rand"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
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

type SpoolService struct {
	db *Database
}

func NewSpoolService(db *Database) *SpoolService {
	return &SpoolService{db: db}
}

func convertBoolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func randomSuffix(length int) (string, error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	for i := range b {
		b[i] = chars[b[i]%byte(len(chars))]
	}
	return string(b), nil
}

func (s *SpoolService) generateSpoolCode(material, color string) (string, error) {
	base := fmt.Sprintf(
		"%s-%s",
		strings.ToUpper(material[:3]),
		strings.ToUpper(color[:2]),
	)

	for {
		suffix, err := randomSuffix(5)
		if err != nil {
			return "", err
		}

		code := fmt.Sprintf("%s-%s", base, suffix)

		var exists bool
		err = s.db.Get(&exists,
			`SELECT EXISTS(SELECT 1 FROM spools WHERE spool_code = ?)`,
			code,
		)
		if err != nil {
			return "", err
		}

		if !exists {
			return code, nil
		}
	}
}

func (s *SpoolService) CreateSpool(spool Spool) (int64, error) {
	now := time.Now()

	code, err := s.generateSpoolCode(spool.Material, spool.Color)
	if err != nil {
		return 0, err
	}

	query := `
	INSERT INTO spools (
		spool_code,
		vendor, material, material_type, color, color_hex,
		total_weight, used_weight,
		cost, reference_link, notes, is_template,
		first_used_at, last_used_at,
		created_at, updated_at
	) VALUES (
		?,
		?, ?, ?, ?, ?,
		?, ?,
		?, ?, ?, ?,
		?, ?,
		?, ?
	)
	`

	result, err := s.db.Exec(
		query,
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
		convertBoolToInt(spool.IsTemplate),
		spool.FirstUsedAt,
		spool.LastUsedAt,
		now,
		now,
	)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (s *SpoolService) UpdateSpool(spool Spool) error {
	if spool.ID == 0 {
		return errors.New("spool ID is required")
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
		convertBoolToInt(spool.IsTemplate),
		spool.FirstUsedAt,
		spool.LastUsedAt,
		time.Now(),
		spool.ID,
	)

	return err
}

func (s *SpoolService) DeleteSpool(id int64) error {
	if id == 0 {
		return errors.New("invalid spool ID")
	}

	_, err := s.db.Exec(`DELETE FROM spools WHERE id = ?`, id)
	return err
}

func (s *SpoolService) GetSpoolByCode(code string) (*Spool, error) {
	var spool Spool
	err := s.db.Get(&spool, `SELECT * FROM spools WHERE spool_code = ?`, code)
	if err != nil {
		return nil, err
	}
	return &spool, nil
}

func (s *SpoolService) GetSpool(id int64) (*Spool, error) {
	var spool Spool
	err := s.db.Get(&spool, `SELECT * FROM spools WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	return &spool, nil
}

// tokenize splits search input into tokens, respecting key:"quoted value" syntax.
func tokenize(search string) []string {
	// Matches either:
	//   key:"quoted value with spaces"
	//   key:unquoted-value
	//   bare-word
	re := regexp.MustCompile(`\w+:"[^"]*"|\S+`)
	return re.FindAllString(strings.TrimSpace(search), -1)
}

func parseSearchQuery(search string) (qualifiers map[string]string, freeText string) {
	qualifiers = make(map[string]string)
	var freeTextParts []string

	for _, token := range tokenize(search) {
		colonIdx := strings.Index(token, ":")
		if colonIdx > 0 {
			key := strings.ToLower(token[:colonIdx])
			value := token[colonIdx+1:]
			// Strip surrounding quotes from value if present
			if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
				value = value[1 : len(value)-1]
			}
			if value != "" {
				qualifiers[key] = strings.ToLower(value)
				continue
			}
		}
		if token != "" {
			freeTextParts = append(freeTextParts, token)
		}
	}

	freeText = strings.Join(freeTextParts, " ")
	return
}

// buildQualifierClause returns a WHERE clause fragment and args for a qualifier.
// It handles wildcard (*) and exact match cases.
func buildQualifierClause(column, val string, argPosition int) (clause string, arg any) {
	if strings.Contains(val, "*") {
		likeVal := strings.ReplaceAll(val, "*", "%")
		return fmt.Sprintf("LOWER(%s) LIKE ?%d", column, argPosition), likeVal
	}
	return fmt.Sprintf("LOWER(%s) = ?%d", column, argPosition), val
}

func (s *SpoolService) QuerySpools(params SpoolQueryParams) (*SpoolQueryResult, error) {
	// Set defaults
	if params.SortBy == "" {
		params.SortBy = "updated_at"
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

		qualifierColumns := map[string]string{
			"spool":    "spool_code",
			"material": "material",
			"vendor":   "vendor",
			"color":    "color",
		}
		for qualifier, column := range qualifierColumns {
			if val, ok := qualifiers[qualifier]; ok {
				clause, arg := buildQualifierClause(column, val, argPosition)
				whereClauses = append(whereClauses, clause)
				args = append(args, arg)
				argPosition++
			}
		}

		if freeText != "" {
			searchPattern := "%" + strings.ToLower(freeText) + "%"
			whereClauses = append(whereClauses, fmt.Sprintf(
				"(LOWER(spool_code) LIKE ?%d OR LOWER(vendor) LIKE ?%d OR LOWER(material) LIKE ?%d OR LOWER(color) LIKE ?%d)",
				argPosition, argPosition+1, argPosition+2, argPosition+3,
			))
			args = append(args, searchPattern, searchPattern, searchPattern, searchPattern)
			argPosition += 4
		}
	}

	if params.IsTemplate != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("is_template = ?%d", argPosition))
		args = append(args, convertBoolToInt(*params.IsTemplate))
		argPosition++
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Validate and sanitize sort column
	validSortColumns := map[string]bool{
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
	sortColumn := params.SortBy
	if !validSortColumns[sortColumn] {
		sortColumn = "updated_at"
	}
	sortOrder := strings.ToUpper(params.SortOrder)
	if sortOrder != "ASC" && sortOrder != "DESC" {
		sortOrder = "DESC"
	}

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM spools %s", whereClause)
	var total int
	err := s.db.Get(&total, countQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to count spools: %w", err)
	}

	// Get paginated results
	query := fmt.Sprintf(
		"SELECT * FROM spools %s ORDER BY %s %s LIMIT ?%d OFFSET ?%d",
		whereClause,
		sortColumn,
		sortOrder,
		argPosition,
		argPosition+1,
	)
	args = append(args, params.Limit, params.Offset)

	var spools []Spool
	err = s.db.Select(&spools, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query spools: %w", err)
	}

	return &SpoolQueryResult{
		Spools: spools,
		Total:  total,
	}, nil
}

// Legacy method - kept for backward compatibility
// func (s *SpoolService) ListSpools() ([]Spool, error) {
// 	var spools []Spool
// 	err := s.db.Select(&spools, `SELECT * FROM spools ORDER BY updated_at DESC`)
// 	return spools, err
// }
