package services

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/wailsapp/wails/v3/pkg/application"
	_ "modernc.org/sqlite"
)

type Database struct {
	db     *sqlx.DB
	cancel context.CancelFunc
}

func (d *Database) DB() *sqlx.DB {
	return d.db
}

func NewDatabase(dbPath string) (*Database, error) {
	absPath, err := filepath.Abs(dbPath)
	if err != nil {
		slog.Error("failed to resolve database path", "error", err)
		return nil, fmt.Errorf("failed to resolve database path: %w", err)
	}

	db, err := sqlx.Open("sqlite", absPath)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Ensure db is closed on any early exit
	closeDB := func() {
		if db != nil {
			_ = db.Close()
		}
	}

	pragmas := []string{
		`PRAGMA journal_mode=WAL`,
		`PRAGMA foreign_keys=ON`,
		`PRAGMA busy_timeout=5000`,
		`PRAGMA synchronous=NORMAL`,
		`PRAGMA cache_size=4000`,
		`PRAGMA temp_store=MEMORY`,
	}

	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			closeDB()
			slog.Error("failed to set pragma", "pragma", p, "error", err)
			return nil, fmt.Errorf("failed to set pragma %q: %w", p, err)
		}
	}

	if err := db.Ping(); err != nil {
		closeDB()
		slog.Error("failed to ping database", "error", err)
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	database := &Database{db: db}

	if err := database.initSchema(); err != nil {
		closeDB()
		slog.Error("failed to initialize schema", "error", err)
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	if err := database.seedSpoolsIfEmpty(); err != nil {
		closeDB()
		slog.Error("failed to seed spools", "error", err)
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

		used_weight REAL NOT NULL DEFAULT 0 CHECK(used_weight >= 0),
		total_weight REAL NOT NULL CHECK(total_weight > 0),

		cost REAL NOT NULL DEFAULT 0,
		reference_link TEXT,
		notes TEXT,

		is_template INTEGER NOT NULL DEFAULT 0,

		first_used_at DATETIME,
		last_used_at DATETIME,

		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_spools_is_template ON spools(is_template);


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

	    grams_used REAL NOT NULL CHECK (grams_used > 0),

	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

	    FOREIGN KEY (print_id) REFERENCES prints(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,

	    FOREIGN KEY (spool_id) REFERENCES spools(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,

	    UNIQUE (print_id, spool_id)
	);

	CREATE INDEX IF NOT EXISTS idx_print_spools_print_id ON print_spools(print_id);
	CREATE INDEX IF NOT EXISTS idx_print_spools_spool_id ON print_spools(spool_id);

	CREATE TABLE IF NOT EXISTS models (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,
	    name TEXT NOT NULL,
	    size INTEGER NOT NULL DEFAULT 0,
	    ext TEXT NOT NULL,
	    hash TEXT UNIQUE, 
	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS print_models (
	    print_id INTEGER NOT NULL,
	    model_id INTEGER NOT NULL,

	    PRIMARY KEY (print_id, model_id),

	    FOREIGN KEY (print_id) REFERENCES prints(id) ON DELETE CASCADE,
	    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS shortcuts (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,
	    action TEXT NOT NULL UNIQUE,
	    key_combo TEXT NOT NULL,
	    description TEXT NOT NULL DEFAULT '',
	    category TEXT NOT NULL,
	    dev_only INTEGER NOT NULL DEFAULT 0,
	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_shortcuts_action ON shortcuts(action);
	CREATE INDEX IF NOT EXISTS idx_shortcuts_key_combo ON shortcuts(key_combo);
	`
	if _, err := d.db.Exec(schema); err != nil {
		slog.Error("failed to init schema", "error", err)
		return fmt.Errorf("failed to init schema: %w", err)
	}

	return nil

}

func (d *Database) seedSpoolsIfEmpty() error {
	var count int
	if err := d.db.Get(&count, `SELECT COUNT(1) FROM spools`); err != nil {
		slog.Error("failed to count spools", "error", err)
		return fmt.Errorf("failed to count spools: %w", err)
	}

	if count > 0 {
		return nil // already seeded
	}

	tx, err := d.db.Beginx()
	if err != nil {
		slog.Error("failed to begin spool seed transaction", "error", err)
		return fmt.Errorf("failed to begin spool seed transaction: %w", err)
	}
	defer tx.Rollback()

	seeds := []Spool{
		{SpoolCode: "PLA-BLK-001", Vendor: "Bambu Labs", Material: "PLA", MaterialType: "Basic", Color: "Black", ColorHex: "#000000", TotalWeight: 1000, Cost: 25, IsTemplate: true, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-WHT-001", Vendor: "Generic", Material: "PLA", MaterialType: "Basic", Color: "White", ColorHex: "#FFFFFF", TotalWeight: 1000, Cost: 2500, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-RED-001", Vendor: "ColorFab", Material: "PLA", MaterialType: "Basic", Color: "Red", ColorHex: "#FF0000", TotalWeight: 1000, Cost: 2600, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-BLU-001", Vendor: "ColorFab", Material: "PLA", MaterialType: "Basic", Color: "Blue", ColorHex: "#0000FF", TotalWeight: 1000, Cost: 2600, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "ABS-BLK-001", Vendor: "StrongFil", Material: "ABS", MaterialType: "Engineering", Color: "Black", ColorHex: "#000000", TotalWeight: 1200, Cost: 3200, IsTemplate: true, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "ABS-WHT-001", Vendor: "StrongFil", Material: "ABS", MaterialType: "Engineering", Color: "White", ColorHex: "#FFFFFF", TotalWeight: 1200, Cost: 3200, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PETG-GRN-001", Vendor: "FlexiPrint", Material: "PETG", MaterialType: "Flexible", Color: "Green", ColorHex: "#00FF00", TotalWeight: 1000, Cost: 2800, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PETG-YLW-001", Vendor: "FlexiPrint", Material: "PETG", MaterialType: "Flexible", Color: "Yellow", ColorHex: "#FFFF00", TotalWeight: 1000, Cost: 2800, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "TPU-BLK-001", Vendor: "SoftFil", Material: "TPU", MaterialType: "Elastic", Color: "Black", ColorHex: "#000000", TotalWeight: 750, Cost: 4000, IsTemplate: true, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "TPU-WHT-001", Vendor: "SoftFil", Material: "TPU", MaterialType: "Elastic", Color: "White", ColorHex: "#FFFFFF", TotalWeight: 750, Cost: 4000, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-GRY-001", Vendor: "Generic", Material: "PLA", MaterialType: "Basic", Color: "Gray", ColorHex: "#888888", TotalWeight: 1000, Cost: 2500, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "ABS-RED-001", Vendor: "StrongFil", Material: "ABS", MaterialType: "Engineering", Color: "Red", ColorHex: "#FF0000", TotalWeight: 1200, Cost: 3200, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PETG-BLU-001", Vendor: "FlexiPrint", Material: "PETG", MaterialType: "Flexible", Color: "Blue", ColorHex: "#0000FF", TotalWeight: 1000, Cost: 2800, IsTemplate: true, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "TPU-GRN-001", Vendor: "SoftFil", Material: "TPU", MaterialType: "Elastic", Color: "Green", ColorHex: "#00FF00", TotalWeight: 750, Cost: 4000, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-CYN-001", Vendor: "ColorFab", Material: "PLA", MaterialType: "Basic", Color: "Cyan", ColorHex: "#00FFFF", TotalWeight: 1000, Cost: 2600, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-MAG-001", Vendor: "ColorFab", Material: "PLA", MaterialType: "Basic", Color: "Magenta", ColorHex: "#FF00FF", TotalWeight: 1000, Cost: 2600, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "ABS-BLU-001", Vendor: "StrongFil", Material: "ABS", MaterialType: "Engineering", Color: "Blue", ColorHex: "#0000FF", TotalWeight: 1200, Cost: 3200, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PETG-RED-001", Vendor: "FlexiPrint", Material: "PETG", MaterialType: "Flexible", Color: "Red", ColorHex: "#FF0000", TotalWeight: 1000, Cost: 2800, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "TPU-YLW-001", Vendor: "SoftFil", Material: "TPU", MaterialType: "Elastic", Color: "Yellow", ColorHex: "#FFFF00", TotalWeight: 750, Cost: 4000, IsTemplate: false, ReferenceLink: "", Notes: ""},
		// {SpoolCode: "PLA-ORG-001", Vendor: "ColorFab", Material: "PLA", MaterialType: "Basic", Color: "Orange", ColorHex: "#FFA500", TotalWeight: 1000, Cost: 2600, IsTemplate: false, ReferenceLink: "", Notes: ""},
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

	for i, s := range seeds {
		if _, err = tx.NamedExec(q, s); err != nil {
			slog.Error("failed to insert seed spool", "index", i, "spool_code", s.SpoolCode, "error", err)
			return fmt.Errorf("failed to insert seed spool (index=%d, spool_code=%s): %w", i, s.SpoolCode, err)
		}
	}

	if err = tx.Commit(); err != nil {
		slog.Error("failed to commit spool seed transaction", "error", err)
		return fmt.Errorf("failed to commit spool seed transaction: %w", err)
	}

	slog.Info("seeded spools successfully", "count", len(seeds))
	return nil
}

func (d *Database) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	slog.Info("Database service started")
	ctx, cancel := context.WithCancel(ctx)
	d.cancel = cancel
	go d.periodicMaintenance(ctx)

	return nil
}

func (d *Database) ServiceShutdown() error {
	slog.Info("Database service started")

	if d.cancel != nil {
		d.cancel()
	}

	if d.db != nil {
		if _, err := d.db.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`); err != nil {
			slog.Error("failed to checkpoint WAL on shutdown", "error", err)
			return fmt.Errorf("failed to checkpoint WAL on shutdown: %w", err)

		}

		if err := d.db.Close(); err != nil {
			slog.Error("failed to close database", "error", err)
			return fmt.Errorf("failed to close database: %w", err)
		}
	}

	slog.Info("Database service shut down cleanly")
	return nil
}

// Runs a WAL checkpoint and incremental VACUUM every hour
func (d *Database) periodicMaintenance(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Stopping periodic maintenance")
			return
		case <-ticker.C:
			slog.Info("Running database maintenance")
			d.runMaintenance()
		}
	}
}

// Cleans up the database periodically to prevent WAL files from growing too large and to reclaim space
func (d *Database) runMaintenance() {
	if _, err := d.db.Exec(`PRAGMA wal_checkpoint(PASSIVE)`); err != nil {
		slog.Error("WAL checkpoint failed", "error", err)
	} else {
		slog.Info("WAL checkpoint succeeded")
	}

	// Incremental VACUUM
	if _, err := d.db.Exec(`PRAGMA incremental_vacuum`); err != nil {
		slog.Error("Incremental VACUUM failed", "error", err)
	} else {
		slog.Info("Incremental VACUUM succeeded")
	}
}
