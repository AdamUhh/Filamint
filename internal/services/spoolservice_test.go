package services

import (
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

// --- Test Helpers ---

func newTestDB(t *testing.T) *sqlx.DB {
	t.Helper()
	db, err := sqlx.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS spools (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		spool_code TEXT NOT NULL UNIQUE,
		vendor TEXT NOT NULL DEFAULT '',
		material TEXT NOT NULL DEFAULT '',
		material_type TEXT NOT NULL DEFAULT '',
		color TEXT NOT NULL DEFAULT '',
		color_hex TEXT NOT NULL DEFAULT '',
		used_weight INTEGER NOT NULL DEFAULT 0,
		total_weight INTEGER NOT NULL DEFAULT 1,
		cost INTEGER NOT NULL DEFAULT 0,
		reference_link TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		is_template INTEGER NOT NULL DEFAULT 0,
		first_used_at DATETIME,
		last_used_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS prints (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT '',
		notes TEXT,
		date_printed DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS print_spools (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		print_id INTEGER NOT NULL,
		spool_id INTEGER NOT NULL,
		grams_used INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (print_id) REFERENCES prints(id) ON DELETE CASCADE,
		FOREIGN KEY (spool_id) REFERENCES spools(id) ON DELETE CASCADE,
		UNIQUE (print_id, spool_id)
	);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to init schema: %v", err)
	}

	t.Cleanup(func() { db.Close() })
	return db
}

func newTestService(t *testing.T) *SpoolService {
	t.Helper()
	db := newTestDB(t)
	return &SpoolService{repo: NewSpoolRepository(db)}
}

func validSpool() Spool {
	return Spool{
		Vendor:       "TestVendor",
		Material:     "PLA",
		MaterialType: "Basic",
		Color:        "Red",
		ColorHex:     "#FF0000",
		TotalWeight:  1000,
		UsedWeight:   0,
		Cost:         2500,
	}
}

// --- validateSpool Tests ---

func TestValidateSpool(t *testing.T) {
	tests := []struct {
		name    string
		spool   Spool
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid spool",
			spool:   validSpool(),
			wantErr: false,
		},
		{
			name:    "missing material",
			spool:   func() Spool { s := validSpool(); s.Material = ""; return s }(),
			wantErr: true,
			errMsg:  "material is required",
		},
		{
			name:    "whitespace-only material",
			spool:   func() Spool { s := validSpool(); s.Material = "   "; return s }(),
			wantErr: true,
			errMsg:  "material is required",
		},
		{
			name:    "missing color",
			spool:   func() Spool { s := validSpool(); s.Color = ""; return s }(),
			wantErr: true,
			errMsg:  "color is required",
		},
		{
			name:    "zero total_weight",
			spool:   func() Spool { s := validSpool(); s.TotalWeight = 0; return s }(),
			wantErr: true,
			errMsg:  "total_weight must be > 0",
		},
		{
			name:    "negative used_weight",
			spool:   func() Spool { s := validSpool(); s.UsedWeight = -1; return s }(),
			wantErr: true,
			errMsg:  "used_weight cannot be negative",
		},
		{
			name:    "used_weight exceeds total_weight",
			spool:   func() Spool { s := validSpool(); s.TotalWeight = 500; s.UsedWeight = 600; return s }(),
			wantErr: true,
			errMsg:  "used_weight cannot exceed total_weight",
		},
		{
			name:    "negative cost",
			spool:   func() Spool { s := validSpool(); s.Cost = -1; return s }(),
			wantErr: true,
			errMsg:  "cost cannot be negative",
		},
		{
			name:    "used_weight equals total_weight (edge case)",
			spool:   func() Spool { s := validSpool(); s.UsedWeight = s.TotalWeight; return s }(),
			wantErr: false,
		},
		{
			name:    "zero cost is valid",
			spool:   func() Spool { s := validSpool(); s.Cost = 0; return s }(),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSpool(tt.spool)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateSpool() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				if err.Error() != tt.errMsg {
					t.Errorf("validateSpool() error msg = %q, want %q", err.Error(), tt.errMsg)
				}
			}
		})
	}
}

// --- SpoolService CRUD Tests ---

func TestCreateSpool(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool()

	id, err := svc.CreateSpool(spool)
	if err != nil {
		t.Fatalf("CreateSpool() unexpected error: %v", err)
	}
	if id <= 0 {
		t.Errorf("CreateSpool() returned id=%d, want > 0", id)
	}
}

func TestCreateSpool_ValidationFailure(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool()
	spool.Material = ""

	_, err := svc.CreateSpool(spool)
	if err == nil {
		t.Error("CreateSpool() expected error for missing material, got nil")
	}
}

func TestGetSpoolById(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool()

	id, err := svc.CreateSpool(spool)
	if err != nil {
		t.Fatalf("CreateSpool() error: %v", err)
	}

	got, err := svc.GetSpoolById(id)
	if err != nil {
		t.Fatalf("GetSpoolById() error: %v", err)
	}
	if got.ID != id {
		t.Errorf("GetSpoolById() id = %d, want %d", got.ID, id)
	}
	if got.Material != spool.Material {
		t.Errorf("GetSpoolById() material = %q, want %q", got.Material, spool.Material)
	}
	if got.Color != spool.Color {
		t.Errorf("GetSpoolById() color = %q, want %q", got.Color, spool.Color)
	}
}

func TestGetSpoolById_NotFound(t *testing.T) {
	svc := newTestService(t)

	_, err := svc.GetSpoolById(9999)
	if err == nil {
		t.Error("GetSpoolById() expected error for non-existent id, got nil")
	}
}

func TestUpdateSpool(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool()

	id, err := svc.CreateSpool(spool)
	if err != nil {
		t.Fatalf("CreateSpool() error: %v", err)
	}

	updated, err := svc.GetSpoolById(id)
	if err != nil {
		t.Fatalf("GetSpoolById() error: %v", err)
	}

	updated.Color = "Blue"
	updated.UsedWeight = 100

	if err := svc.UpdateSpool(*updated); err != nil {
		t.Fatalf("UpdateSpool() error: %v", err)
	}

	got, err := svc.GetSpoolById(id)
	if err != nil {
		t.Fatalf("GetSpoolById() after update error: %v", err)
	}
	if got.Color != "Blue" {
		t.Errorf("UpdateSpool() color = %q, want %q", got.Color, "Blue")
	}
	if got.UsedWeight != 100 {
		t.Errorf("UpdateSpool() used_weight = %d, want %d", got.UsedWeight, 100)
	}
}

func TestUpdateSpool_MissingID(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool() // ID is 0

	err := svc.UpdateSpool(spool)
	if err == nil {
		t.Error("UpdateSpool() expected error for zero ID, got nil")
	}
}

func TestUpdateSpool_ValidationFailure(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool()

	id, err := svc.CreateSpool(spool)
	if err != nil {
		t.Fatalf("CreateSpool() error: %v", err)
	}

	got, _ := svc.GetSpoolById(id)
	got.TotalWeight = -1

	err = svc.UpdateSpool(*got)
	if err == nil {
		t.Error("UpdateSpool() expected validation error, got nil")
	}
}

func TestDeleteSpool(t *testing.T) {
	svc := newTestService(t)
	spool := validSpool()

	id, err := svc.CreateSpool(spool)
	if err != nil {
		t.Fatalf("CreateSpool() error: %v", err)
	}

	if err := svc.DeleteSpool(id); err != nil {
		t.Fatalf("DeleteSpool() error: %v", err)
	}

	_, err = svc.GetSpoolById(id)
	if err == nil {
		t.Error("GetSpoolById() expected error after delete, got nil")
	}
}

func TestDeleteSpool_InvalidID(t *testing.T) {
	svc := newTestService(t)

	err := svc.DeleteSpool(0)
	if err == nil {
		t.Error("DeleteSpool() expected error for id=0, got nil")
	}
}

// --- QuerySpools Tests ---

func TestQuerySpools_Defaults(t *testing.T) {
	svc := newTestService(t)

	for range 3 {
		if _, err := svc.CreateSpool(validSpool()); err != nil {
			t.Fatalf("CreateSpool() error: %v", err)
		}
	}

	result, err := svc.QuerySpools(SpoolQueryParams{})
	if err != nil {
		t.Fatalf("QuerySpools() error: %v", err)
	}
	if result.Total != 3 {
		t.Errorf("QuerySpools() total = %d, want %d", result.Total, 3)
	}
	if len(result.Spools) != 3 {
		t.Errorf("QuerySpools() len = %d, want %d", len(result.Spools), 3)
	}
}

func TestQuerySpools_SearchFreeText(t *testing.T) {
	svc := newTestService(t)

	s1 := validSpool()
	s1.Material = "PETG"
	s1.Color = "Green"
	svc.CreateSpool(s1)

	s2 := validSpool()
	s2.Material = "ABS"
	s2.Color = "Blue"
	svc.CreateSpool(s2)

	result, err := svc.QuerySpools(SpoolQueryParams{Search: "PETG"})
	if err != nil {
		t.Fatalf("QuerySpools() error: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("QuerySpools(search=PETG) total = %d, want 1", result.Total)
	}
}

func TestQuerySpools_IsTemplateFilter(t *testing.T) {
	svc := newTestService(t)

	tmpl := validSpool()
	tmpl.IsTemplate = true
	svc.CreateSpool(tmpl)

	regular := validSpool()
	regular.IsTemplate = false
	svc.CreateSpool(regular)

	isTemplate := true
	result, err := svc.QuerySpools(SpoolQueryParams{IsTemplate: &isTemplate})
	if err != nil {
		t.Fatalf("QuerySpools() error: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("QuerySpools(isTemplate=true) total = %d, want 1", result.Total)
	}
	if !result.Spools[0].IsTemplate {
		t.Error("QuerySpools() returned non-template spool")
	}
}

func TestQuerySpools_Pagination(t *testing.T) {
	svc := newTestService(t)

	for range 5 {
		svc.CreateSpool(validSpool())
	}

	result, err := svc.QuerySpools(SpoolQueryParams{Limit: 2, Offset: 0})
	if err != nil {
		t.Fatalf("QuerySpools() error: %v", err)
	}
	if result.Total != 5 {
		t.Errorf("QuerySpools() total = %d, want 5", result.Total)
	}
	if len(result.Spools) != 2 {
		t.Errorf("QuerySpools() page len = %d, want 2", len(result.Spools))
	}

	page2, err := svc.QuerySpools(SpoolQueryParams{Limit: 2, Offset: 2})
	if err != nil {
		t.Fatalf("QuerySpools() page2 error: %v", err)
	}
	if len(page2.Spools) != 2 {
		t.Errorf("QuerySpools() page2 len = %d, want 2", len(page2.Spools))
	}
}

func TestQuerySpools_InvalidSortColumnDefaultsToUpdatedAt(t *testing.T) {
	svc := newTestService(t)
	svc.CreateSpool(validSpool())

	// Should not error even with a potentially injected column name
	result, err := svc.QuerySpools(SpoolQueryParams{SortBy: "'; DROP TABLE spools; --"})
	if err != nil {
		t.Fatalf("QuerySpools() error: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("QuerySpools() with bad sort column: total = %d, want 1", result.Total)
	}
}

// --- SpoolRepository Tests ---

func TestRepository_Insert(t *testing.T) {
	db := newTestDB(t)
	repo := NewSpoolRepository(db)

	now := time.Now()
	spool := validSpool()
	spool.CreatedAt = now
	spool.UpdatedAt = now

	id, err := repo.Insert(spool, "PLA-RED-XYZ")
	if err != nil {
		t.Fatalf("Insert() error: %v", err)
	}
	if id <= 0 {
		t.Errorf("Insert() id = %d, want > 0", id)
	}
}

func TestRepository_Insert_DuplicateCode(t *testing.T) {
	db := newTestDB(t)
	repo := NewSpoolRepository(db)

	now := time.Now()
	spool := validSpool()
	spool.CreatedAt = now
	spool.UpdatedAt = now

	if _, err := repo.Insert(spool, "DUPE-001"); err != nil {
		t.Fatalf("first Insert() error: %v", err)
	}

	_, err := repo.Insert(spool, "DUPE-001")
	if err == nil {
		t.Error("second Insert() with duplicate code expected error, got nil")
	}
}

func TestRepository_Update(t *testing.T) {
	db := newTestDB(t)
	repo := NewSpoolRepository(db)

	now := time.Now()
	spool := validSpool()
	spool.CreatedAt = now
	spool.UpdatedAt = now

	id, _ := repo.Insert(spool, "UPD-001")

	spool.ID = id
	spool.Color = "Purple"
	spool.UpdatedAt = time.Now()

	if err := repo.Update(spool); err != nil {
		t.Fatalf("Update() error: %v", err)
	}

	got, err := repo.GetSpool(id)
	if err != nil {
		t.Fatalf("GetSpool() error: %v", err)
	}
	if got.Color != "Purple" {
		t.Errorf("Update() color = %q, want %q", got.Color, "Purple")
	}
}

func TestRepository_Delete(t *testing.T) {
	db := newTestDB(t)
	repo := NewSpoolRepository(db)

	now := time.Now()
	spool := validSpool()
	spool.CreatedAt = now
	spool.UpdatedAt = now

	id, _ := repo.Insert(spool, "DEL-001")

	if err := repo.Delete(id); err != nil {
		t.Fatalf("Delete() error: %v", err)
	}

	_, err := repo.GetSpool(id)
	if err == nil {
		t.Error("GetSpool() expected error after delete, got nil")
	}
}

func TestRepository_GetPrints(t *testing.T) {
	db := newTestDB(t)
	repo := NewSpoolRepository(db)

	now := time.Now()
	spool := validSpool()
	spool.CreatedAt = now
	spool.UpdatedAt = now
	spoolID, _ := repo.Insert(spool, "PRN-001")

	// Insert a print and link it
	res, _ := db.Exec(`INSERT INTO prints (name, status) VALUES ('Test Print', 'done')`)
	printID, _ := res.LastInsertId()
	db.Exec(`INSERT INTO print_spools (print_id, spool_id, grams_used) VALUES (?, ?, ?)`, printID, spoolID, 50)

	prints, err := repo.GetPrints(spoolID)
	if err != nil {
		t.Fatalf("GetPrints() error: %v", err)
	}
	if len(prints) != 1 {
		t.Errorf("GetPrints() len = %d, want 1", len(prints))
	}
	if prints[0].GramsUsed != 50 {
		t.Errorf("GetPrints() grams_used = %d, want 50", prints[0].GramsUsed)
	}
}

func TestRepository_GetPrints_Empty(t *testing.T) {
	db := newTestDB(t)
	repo := NewSpoolRepository(db)

	now := time.Now()
	spool := validSpool()
	spool.CreatedAt = now
	spool.UpdatedAt = now
	spoolID, _ := repo.Insert(spool, "NOP-001")

	prints, err := repo.GetPrints(spoolID)
	if err != nil {
		t.Fatalf("GetPrints() error: %v", err)
	}
	if len(prints) != 0 {
		t.Errorf("GetPrints() len = %d, want 0", len(prints))
	}
}
