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

	// ---- SEEDING (comment out any line to disable) ----
	if err := database.seedSpoolsIfEmpty(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to seed spools: %w", err)
	}

	return database, nil
}

func (d *Database) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS spools (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		spool_code TEXT NOT NULL UNIQUE,

		vendor TEXT NOT NULL,
		material TEXT NOT NULL,
		material_type TEXT NOT NULL,
		color TEXT NOT NULL,
		color_hex TEXT NOT NULL,

		total_weight INTEGER NOT NULL,
		used_weight INTEGER NOT NULL DEFAULT 0,

		cost INTEGER NOT NULL DEFAULT 0,
		reference_link TEXT,
		notes TEXT,

		is_template INTEGER NOT NULL DEFAULT 0,

		first_used_at DATETIME,
		last_used_at DATETIME,

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_spools_is_template ON spools(is_template);
	CREATE INDEX IF NOT EXISTS idx_spools_spool_code ON spools(spool_code);


	CREATE TABLE IF NOT EXISTS prints (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,

	    name TEXT NOT NULL,
	    status TEXT NOT NULL,

	    notes TEXT,
	    date_printed DATETIME,

	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS print_spools (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,

	    print_id INTEGER NOT NULL,
	    spool_id INTEGER NOT NULL,

	    grams_used INTEGER NOT NULL CHECK (grams_used > 0),

	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

	    FOREIGN KEY (print_id) REFERENCES prints(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,

	    FOREIGN KEY (spool_id) REFERENCES spools(id)
		ON DELETE RESTRICT
		ON UPDATE CASCADE,

	    UNIQUE (print_id, spool_id)
	);

	CREATE INDEX IF NOT EXISTS idx_print_spools_print_id ON print_spools(print_id);
	CREATE INDEX IF NOT EXISTS idx_print_spools_spool_id ON print_spools(spool_id);
	`
	_, err := d.db.Exec(schema)
	return err
}

func (d *Database) seedSpoolsIfEmpty() error {
	var count int
	if err := d.db.Get(&count, `SELECT COUNT(1) FROM spools`); err != nil {
		return err
	}

	if count > 0 {
		return nil // already seeded
	}

	tx, err := d.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	seeds := []Spool{
		{
			SpoolCode:     "PLA-BLK-001",
			Vendor:        "Generic",
			Material:      "PLA",
			MaterialType:  "Basic",
			Color:         "Black",
			ColorHex:      "#000000",
			TotalWeight:   1000,
			Cost:          2500,
			IsTemplate:    true,
			ReferenceLink: "",
			Notes:         "",
		},
		{
			SpoolCode:     "PLA-WHT-001",
			Vendor:        "Generic",
			Material:      "PLA",
			MaterialType:  "Basic",
			Color:         "White",
			ColorHex:      "#FFFFFF",
			TotalWeight:   1000,
			Cost:          2500,
			IsTemplate:    false,
			ReferenceLink: "",
			Notes:         "",
		},
	}

	const q = `
		INSERT INTO spools (
			spool_code,
			vendor,
			material,
			material_type,
			color,
			color_hex,
			total_weight,
			cost,
			is_template,
			reference_link,
			notes
		) VALUES (
			:spool_code,
			:vendor,
			:material,
			:material_type,
			:color,
			:color_hex,
			:total_weight,
			:cost,
			:is_template,
			:reference_link,
			:notes
		)
	`

	for _, s := range seeds {
		if _, err := tx.NamedExec(q, s); err != nil {
			return err
		}
	}

	return tx.Commit()
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
