package main

import (
	"fmt"
	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
	"path/filepath"
)

type Database struct {
	db *sqlx.DB
}

func NewDatabase(dbPath string) (*Database, error) {
	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve database path: %w", err)
	}

	db, err := sqlx.Open("sqlite", absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	database := &Database{db: db}

	if err := database.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return database, nil
}

func (d *Database) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS spools (
		id INTEGER PRIMARY KEY AUTOINCREMENT,

		vendor TEXT NOT NULL,
		material TEXT NOT NULL,
		material_type TEXT,
		color TEXT,
		color_rgb TEXT,

		total_weight INTEGER NOT NULL,
		used_weight INTEGER NOT NULL DEFAULT 0,

		cost INTEGER NOT NULL DEFAULT 0,
		reference_link TEXT,
		notes TEXT,

		first_used_at DATETIME,
		last_used_at DATETIME,

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_spools_material ON spools(material);
	`
	_, err := d.db.Exec(schema)
	return err
}

// Generic query methods that can be used by any repository
func (d *Database) Select(dest interface{}, query string, args ...interface{}) error {
	return d.db.Select(dest, query, args...)
}

func (d *Database) Get(dest interface{}, query string, args ...interface{}) error {
	return d.db.Get(dest, query, args...)
}

func (d *Database) Exec(query string, args ...interface{}) (Result, error) {
	result, err := d.db.Exec(query, args...)
	if err != nil {
		return Result{}, err
	}
	return Result{result: result}, nil
}

// Result wraps sql.Result for easier use
type Result struct {
	result interface {
		LastInsertId() (int64, error)
		RowsAffected() (int64, error)
	}
}

func (r Result) LastInsertId() (int64, error) {
	return r.result.LastInsertId()
}

func (r Result) RowsAffected() (int64, error) {
	return r.result.RowsAffected()
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *Database) ServiceShutdown() error {
	// Close database
	if err := d.Close(); err != nil {
		return fmt.Errorf("failed to close database: %w", err)
	}

	return nil
}
