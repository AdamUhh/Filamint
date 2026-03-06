package services

import (
	"changeme/internal"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

type PrintRepository struct {
	db *sqlx.DB
}

func NewPrintRepository(db *sqlx.DB) *PrintRepository {
	return &PrintRepository{db: db}
}

func (r *PrintRepository) InsertPrint(tx *sqlx.Tx, p Print, now any) (int64, error) {
	res, err := tx.Exec(
		`INSERT INTO prints (name, status, notes, date_printed, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		p.Name, p.Status, p.Notes, p.DatePrinted, now, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *PrintRepository) InsertPrintSpool(tx *sqlx.Tx, printID int64, ps PrintSpool, now any) error {
	_, err := tx.Exec(
		`INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		printID, ps.SpoolID, ps.GramsUsed, now, now,
	)
	return err
}

func (r *PrintRepository) AddSpoolUsedWeight(tx *sqlx.Tx, spoolID int64, grams int, now any) error {
	_, err := tx.Exec(
		`UPDATE spools
		 SET used_weight = used_weight + ?,
		     last_used_at = ?,
		     first_used_at = COALESCE(first_used_at, ?),
		     updated_at = ?
		 WHERE id = ?`,
		grams, now, now, now, spoolID,
	)
	return err
}

func (r *PrintRepository) UpdatePrintFields(tx *sqlx.Tx, p Print, now any) error {
	_, err := tx.Exec(
		`UPDATE prints
		SET name = ?, status = ?, notes = ?, date_printed = ?, updated_at = ? WHERE id = ?`,
		p.Name, p.Status, p.Notes, p.DatePrinted, now, p.ID,
	)
	return err
}

func (r *PrintRepository) GetPrintSpools(tx *sqlx.Tx, printID int64) ([]PrintSpool, error) {
	var spools []PrintSpool
	err := tx.Select(&spools,
		`SELECT spool_id, grams_used FROM print_spools WHERE print_id = ?`,
		printID,
	)
	return spools, err
}

func (r *PrintRepository) DeletePrintSpool(tx *sqlx.Tx, printID, spoolID int64) error {
	_, err := tx.Exec(
		`DELETE FROM print_spools WHERE print_id = ? AND spool_id = ?`, printID, spoolID,
	)
	return err
}

func (r *PrintRepository) SubtractSpoolUsedWeight(tx *sqlx.Tx, spoolID int64, grams int, now any) error {
	_, err := tx.Exec(
		`UPDATE spools SET used_weight = used_weight - ?, updated_at = ? WHERE id = ?`,
		grams, now, spoolID,
	)
	return err
}

func (r *PrintRepository) UpsertPrintSpool(tx *sqlx.Tx, printID int64, ps PrintSpool, now any) error {
	_, err := tx.Exec(
		`UPDATE print_spools SET grams_used = ?, updated_at = ? WHERE print_id = ? AND spool_id = ?`,
		ps.GramsUsed, now, printID, ps.SpoolID,
	)
	return err
}

func (r *PrintRepository) GetModelIDsForPrint(tx *sqlx.Tx, printID int64) ([]int64, error) {
	var ids []int64
	err := tx.Select(&ids, `SELECT model_id FROM print_models WHERE print_id = ?`, printID)
	return ids, err
}

func (r *PrintRepository) DeletePrintModels(tx *sqlx.Tx, printID int64) error {
	_, err := tx.Exec(`DELETE FROM print_models WHERE print_id = ?`, printID)
	return err
}

func (r *PrintRepository) DeletePrint(tx *sqlx.Tx, printID int64) error {
	_, err := tx.Exec(`DELETE FROM prints WHERE id = ?`, printID)
	return err
}

func (r *PrintRepository) FindOrphanedModels(tx *sqlx.Tx, modelIDs []int64) ([]PrintModel, error) {
	query, args, err := sqlx.In(
		`SELECT id, ext FROM models WHERE id IN (?) AND id NOT IN (SELECT model_id FROM print_models)`,
		modelIDs,
	)
	if err != nil {
		return nil, err
	}
	var models []PrintModel
	err = tx.Select(&models, r.db.Rebind(query), args...)
	return models, err
}

func (r *PrintRepository) DeleteModelByID(tx *sqlx.Tx, modelID int64) error {
	_, err := tx.Exec(`DELETE FROM models WHERE id = ?`, modelID)
	return err
}

func (r *PrintRepository) GetModelsForPrint(printID int64) ([]PrintModel, error) {
	var models []PrintModel
	err := r.db.Select(&models, `
		SELECT m.id, m.name, m.size, m.ext
		FROM models m
		INNER JOIN print_models pm ON pm.model_id = m.id
		WHERE pm.print_id = ?`, printID)
	return models, err
}

func (r *PrintRepository) FindModelByHash(tx *sqlx.Tx, hash string) (int64, error) {
	var id int64
	err := tx.Get(&id, `SELECT id FROM models WHERE hash = ?`, hash)
	return id, err
}

func (r *PrintRepository) InsertModel(tx *sqlx.Tx, fileName, ext, hash string, size int64, now any) (int64, error) {
	res, err := tx.Exec(
		`INSERT INTO models(name, size, ext, hash, created_at) VALUES (?, ?, ?, ?, ?)`,
		fileName, size, ext, hash, now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *PrintRepository) LinkModelToPrint(tx *sqlx.Tx, printID, modelID int64) error {
	_, err := tx.Exec(
		`INSERT INTO print_models(print_id, model_id) VALUES (?, ?)`, printID, modelID,
	)
	return err
}

func (r *PrintRepository) UnlinkModelFromPrint(tx *sqlx.Tx, printID, modelID int64) error {
	_, err := tx.Exec(
		`DELETE FROM print_models WHERE print_id = ? AND model_id = ?`,
		printID, modelID,
	)
	return err
}

// DeleteModelIfOrphaned deletes the model record if no print_models rows reference it,
// returning the ext so the caller can remove the file. Returns ("", sql.ErrNoRows) if
// the model still has references.
func (r *PrintRepository) DeleteModelIfOrphaned(tx *sqlx.Tx, modelID int64) (string, error) {
	var ext string
	err := tx.Get(&ext, `
		DELETE FROM models
		WHERE id = ?
		AND NOT EXISTS (
			SELECT 1 FROM print_models WHERE model_id = ?
		)
		RETURNING ext
	`, modelID, modelID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", sql.ErrNoRows
	}
	return ext, err
}

func (r *PrintRepository) QueryPrints(params PrintQueryParams) (*PrintQueryResult, error) {
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

	query := fmt.Sprintf(
		"SELECT *, COUNT(*) OVER() AS total_count FROM prints %s ORDER BY %s %s LIMIT ? OFFSET ?",
		whereClause, params.SortBy, params.SortOrder,
	)

	pageArgs := make([]any, len(args), len(args)+2)
	copy(pageArgs, args)
	pageArgs = append(pageArgs, params.Limit, params.Offset)

	var rows []struct {
		Print
		TotalCount int `db:"total_count"`
	}
	if err := r.db.Select(&rows, query, pageArgs...); err != nil {
		return nil, fmt.Errorf("failed to query prints: %w", err)
	}

	prints := make([]Print, len(rows))
	total := 0
	if len(rows) > 0 {
		total = rows[0].TotalCount
	}
	for i, r := range rows {
		prints[i] = r.Print
	}

	if len(prints) == 0 {
		return &PrintQueryResult{Prints: prints, Total: total}, nil
	}

	ids := make([]int64, len(prints))
	for i, p := range prints {
		ids[i] = p.ID
	}

	allSpools, err := r.GetSpoolsForPrints(ids)
	if err != nil {
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

func (r *PrintRepository) GetSpoolsForPrints(printIDs []int64) ([]PrintSpool, error) {
	query, args, err := sqlx.In(`
		SELECT
			ps.id, ps.print_id, ps.spool_id, ps.grams_used, ps.created_at, ps.updated_at,
			s.color, s.color_hex, s.vendor, s.material, s.spool_code, s.total_weight, s.used_weight
		FROM print_spools ps
		JOIN spools s ON s.id = ps.spool_id
		WHERE ps.print_id IN (?)
	`, printIDs)
	if err != nil {
		return nil, err
	}
	var spools []PrintSpool
	err = r.db.Select(&spools, r.db.Rebind(query), args...)
	return spools, err
}

func (r *PrintRepository) Begin() (*sqlx.Tx, error) {
	return r.db.Beginx()
}

func (r *PrintRepository) GetPrintModelById(printID int64) (PrintModel, error) {
	var model PrintModel

	err := r.db.Get(&model, `
		SELECT m.id, m.name, m.size, m.ext
		FROM models m
		INNER JOIN print_models pm ON pm.model_id = m.id
		WHERE pm.print_id = ?
		LIMIT 1
	`, printID)

	return model, err
}
