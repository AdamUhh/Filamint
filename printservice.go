package main

import (
	"errors"
	"time"
)

type Print struct {
	ID int64 `db:"id" json:"id"`

	Name string `db:"name" json:"name"`

	SpoolID int64 `db:"spool_id" json:"spoolId"`

	GramsUsed int    `db:"grams_used" json:"gramsUsed"`
	Status    string `db:"status" json:"status"`

	Notes string `db:"notes" json:"notes"`

	DatePrinted *time.Time `db:"date_printed" json:"datePrinted"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

type PrintService struct {
	db *Database
}

func NewPrintService(db *Database) *PrintService {
	return &PrintService{db: db}
}

func (s *PrintService) CreatePrint(p Print) (int64, error) {
	now := time.Now()

	query := `
	INSERT INTO prints (
		name,
		spool_id,
		grams_used,
		status,
		notes,
		date_printed,
		created_at,
		updated_at
	) VALUES (
		?, ?, ?, ?, ?, ?, ?, ?
	)
	`

	result, err := s.db.Exec(
		query,
		p.Name,
		p.SpoolID,
		p.GramsUsed,
		p.Status,
		p.Notes,
		p.DatePrinted,
		now,
		now,
	)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (s *PrintService) UpdatePrint(p Print) error {
	if p.ID == 0 {
		return errors.New("print ID is required")
	}

	query := `
	UPDATE prints SET
		name = ?,
		spool_id = ?,
		grams_used = ?,
		status = ?,
		notes = ?,
		date_printed = ?,
		updated_at = ?
	WHERE id = ?
	`

	_, err := s.db.Exec(
		query,
		p.Name,
		p.SpoolID,
		p.GramsUsed,
		p.Status,
		p.Notes,
		p.DatePrinted,
		time.Now(),
		p.ID,
	)

	return err
}

func (s *PrintService) DeletePrint(id int64) error {
	if id == 0 {
		return errors.New("invalid print ID")
	}

	_, err := s.db.Exec(`DELETE FROM prints WHERE id = ?`, id)
	return err
}

func (s *PrintService) GetPrint(id int64) (*Print, error) {
	var p Print

	err := s.db.Get(&p, `SELECT * FROM prints WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}

	return &p, nil
}

func (s *PrintService) ListPrints() ([]Print, error) {
	var prints []Print

	err := s.db.Select(
		&prints,
		`SELECT * FROM prints ORDER BY created_at DESC`,
	)

	return prints, err
}
