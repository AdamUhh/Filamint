package services

import (
	"fmt"
	"testing"
	"time"
)

// --- Test Helpers ---

func newTestPrintService(t *testing.T) *PrintService {
	t.Helper()
	db := newTestDB(t) // reuses helper from spoolservice_test.go
	return &PrintService{
		repo:      NewPrintRepository(db),
		modelsDir: t.TempDir(),
	}
}

func insertTestSpool(t *testing.T, svc *PrintService, code string) int64 {
	t.Helper()
	now := time.Now()
	id, err := svc.repo.db.Exec(`
		INSERT INTO spools (spool_code, vendor, material, material_type, color, color_hex, total_weight, used_weight, cost, reference_link, notes, created_at, updated_at)
		VALUES (?, 'Vendor', 'PLA', 'Basic', 'Red', '#FF0000', 1000, 0, 2500, '', '', ?, ?)`,
		code, now, now,
	)
	if err != nil {
		t.Fatalf("insertTestSpool() error: %v", err)
	}
	spoolID, _ := id.LastInsertId()
	return spoolID
}

func validPrint() Print {
	return Print{
		Name:   "Test Print",
		Status: "done",
		Notes:  "some notes",
	}
}

// --- validateAppPath Tests ---

func TestValidateAppPath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{
			name:    "bare executable name",
			path:    "prusaslicer",
			wantErr: false,
		},
		{
			name:    "bare name with dots and hyphens",
			path:    "my-app.exe",
			wantErr: false,
		},
		{
			name:    "empty path",
			path:    "",
			wantErr: true,
		},
		{
			name:    "path too long",
			path:    string(make([]byte, 513)),
			wantErr: true,
		},
		{
			name:    "directory traversal",
			path:    "../etc/passwd",
			wantErr: true,
		},
		{
			name:    "null byte injection",
			path:    "app\x00bad",
			wantErr: true,
		},
		{
			name:    "shell semicolon injection",
			path:    "app;rm -rf /",
			wantErr: true,
		},
		{
			name:    "pipe injection",
			path:    "app|whoami",
			wantErr: true,
		},
		{
			name:    "backtick injection",
			path:    "app`id`",
			wantErr: true,
		},
		{
			name:    "env var expansion %VAR%",
			path:    "%APPDATA%\\evil.exe",
			wantErr: true,
		},
		{
			name:    "env var expansion $VAR",
			path:    "$HOME/evil",
			wantErr: true,
		},
		{
			name:    "UNC network path",
			path:    `\\server\share\app.exe`,
			wantErr: true,
		},
		{
			name:    "script extension .sh",
			path:    "run.sh",
			wantErr: true,
		},
		{
			name:    "script extension .py",
			path:    "script.py",
			wantErr: true,
		},
		{
			name:    "script extension .ps1",
			path:    "evil.ps1",
			wantErr: true,
		},
		{
			name:    "interpreter name bash",
			path:    "bash",
			wantErr: true,
		},
		{
			name:    "interpreter name python3",
			path:    "python3",
			wantErr: true,
		},
		{
			name:    "interpreter name powershell",
			path:    "powershell",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAppPath(tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateAppPath(%q) error = %v, wantErr %v", tt.path, err, tt.wantErr)
			}
		})
	}
}

// --- CreatePrint Tests ---

func TestCreatePrint_NoSpools(t *testing.T) {
	svc := newTestPrintService(t)
	p := validPrint()

	id, err := svc.CreatePrint(p)
	if err != nil {
		t.Fatalf("CreatePrint() error: %v", err)
	}
	if id <= 0 {
		t.Errorf("CreatePrint() id = %d, want > 0", id)
	}
}

func TestCreatePrint_WithSpools(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-T01")

	p := validPrint()
	p.Spools = []PrintSpool{
		{SpoolID: spoolID, GramsUsed: 50},
	}

	id, err := svc.CreatePrint(p)
	if err != nil {
		t.Fatalf("CreatePrint() error: %v", err)
	}
	if id <= 0 {
		t.Errorf("CreatePrint() id = %d, want > 0", id)
	}

	// Verify spool used_weight was updated
	var usedWeight int
	svc.repo.db.Get(&usedWeight, `SELECT used_weight FROM spools WHERE id = ?`, spoolID)
	if usedWeight != 50 {
		t.Errorf("CreatePrint() spool used_weight = %d, want 50", usedWeight)
	}
}

func TestCreatePrint_MultipleSpools(t *testing.T) {
	svc := newTestPrintService(t)
	s1 := insertTestSpool(t, svc, "PLA-RED-T02")
	s2 := insertTestSpool(t, svc, "ABS-BLK-T02")

	p := validPrint()
	p.Spools = []PrintSpool{
		{SpoolID: s1, GramsUsed: 30},
		{SpoolID: s2, GramsUsed: 70},
	}

	_, err := svc.CreatePrint(p)
	if err != nil {
		t.Fatalf("CreatePrint() error: %v", err)
	}

	var w1, w2 int
	svc.repo.db.Get(&w1, `SELECT used_weight FROM spools WHERE id = ?`, s1)
	svc.repo.db.Get(&w2, `SELECT used_weight FROM spools WHERE id = ?`, s2)

	if w1 != 30 {
		t.Errorf("spool1 used_weight = %d, want 30", w1)
	}
	if w2 != 70 {
		t.Errorf("spool2 used_weight = %d, want 70", w2)
	}
}

// --- UpdatePrint Tests ---

func TestUpdatePrint_MissingID(t *testing.T) {
	svc := newTestPrintService(t)
	err := svc.UpdatePrint(validPrint()) // ID == 0
	if err == nil {
		t.Error("UpdatePrint() expected error for zero ID, got nil")
	}
}

func TestUpdatePrint_Fields(t *testing.T) {
	svc := newTestPrintService(t)
	id, _ := svc.CreatePrint(validPrint())

	updated := validPrint()
	updated.ID = id
	updated.Name = "Updated Name"
	updated.Status = "in_progress"

	if err := svc.UpdatePrint(updated); err != nil {
		t.Fatalf("UpdatePrint() error: %v", err)
	}

	var name, status string
	svc.repo.db.QueryRow(`SELECT name, status FROM prints WHERE id = ?`, id).Scan(&name, &status)
	if name != "Updated Name" {
		t.Errorf("UpdatePrint() name = %q, want %q", name, "Updated Name")
	}
	if status != "in_progress" {
		t.Errorf("UpdatePrint() status = %q, want %q", status, "in_progress")
	}
}

func TestUpdatePrint_AddSpool(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-T03")
	id, _ := svc.CreatePrint(validPrint())

	updated := validPrint()
	updated.ID = id
	updated.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 40}}

	if err := svc.UpdatePrint(updated); err != nil {
		t.Fatalf("UpdatePrint() error: %v", err)
	}

	var usedWeight int
	svc.repo.db.Get(&usedWeight, `SELECT used_weight FROM spools WHERE id = ?`, spoolID)
	if usedWeight != 40 {
		t.Errorf("UpdatePrint() after adding spool: used_weight = %d, want 40", usedWeight)
	}
}

func TestUpdatePrint_RemoveSpool(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-T04")

	p := validPrint()
	p.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 60}}
	id, _ := svc.CreatePrint(p)

	// Update with no spools - should subtract weight back
	updated := validPrint()
	updated.ID = id
	updated.Spools = []PrintSpool{}

	if err := svc.UpdatePrint(updated); err != nil {
		t.Fatalf("UpdatePrint() error: %v", err)
	}

	var usedWeight int
	svc.repo.db.Get(&usedWeight, `SELECT used_weight FROM spools WHERE id = ?`, spoolID)
	if usedWeight != 0 {
		t.Errorf("UpdatePrint() after removing spool: used_weight = %d, want 0", usedWeight)
	}
}

func TestUpdatePrint_ChangeGrams(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-T05")

	p := validPrint()
	p.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 50}}
	id, _ := svc.CreatePrint(p)

	// Increase: 50 -> 80 (delta = +30)
	updated := validPrint()
	updated.ID = id
	updated.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 80}}

	if err := svc.UpdatePrint(updated); err != nil {
		t.Fatalf("UpdatePrint() increase error: %v", err)
	}

	var usedWeight int
	svc.repo.db.Get(&usedWeight, `SELECT used_weight FROM spools WHERE id = ?`, spoolID)
	if usedWeight != 80 {
		t.Errorf("UpdatePrint() increase: used_weight = %d, want 80", usedWeight)
	}

	// Decrease: 80 -> 30 (delta = -50)
	updated.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 30}}

	if err := svc.UpdatePrint(updated); err != nil {
		t.Fatalf("UpdatePrint() decrease error: %v", err)
	}

	svc.repo.db.Get(&usedWeight, `SELECT used_weight FROM spools WHERE id = ?`, spoolID)
	if usedWeight != 30 {
		t.Errorf("UpdatePrint() decrease: used_weight = %d, want 30", usedWeight)
	}
}

// --- DeletePrint Tests ---

func TestDeletePrint_InvalidID(t *testing.T) {
	svc := newTestPrintService(t)
	err := svc.DeletePrint(0, false)
	if err == nil {
		t.Error("DeletePrint() expected error for id=0, got nil")
	}
}

func TestDeletePrint_NoRestore(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-T06")

	p := validPrint()
	p.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 100}}
	id, _ := svc.CreatePrint(p)

	if err := svc.DeletePrint(id, false); err != nil {
		t.Fatalf("DeletePrint() error: %v", err)
	}

	// Spool weight should remain unchanged
	var usedWeight int
	svc.repo.db.Get(&usedWeight, `SELECT used_weight FROM spools WHERE id = ?`, spoolID)
	if usedWeight != 100 {
		t.Errorf("DeletePrint(restoreSpoolGrams=false) used_weight = %d, want 100", usedWeight)
	}

	// Print should be gone
	var count int
	svc.repo.db.Get(&count, `SELECT COUNT(*) FROM prints WHERE id = ?`, id)
	if count != 0 {
		t.Errorf("DeletePrint() print still exists after delete")
	}
}

func TestDeletePrint_WithRestore(t *testing.T) {
	svc := newTestPrintService(t)
	s1 := insertTestSpool(t, svc, "PLA-RED-T07")
	s2 := insertTestSpool(t, svc, "ABS-BLK-T07")

	p := validPrint()
	p.Spools = []PrintSpool{
		{SpoolID: s1, GramsUsed: 100},
		{SpoolID: s2, GramsUsed: 45},
	}
	id, _ := svc.CreatePrint(p)

	if err := svc.DeletePrint(id, true); err != nil {
		t.Fatalf("DeletePrint() error: %v", err)
	}

	var w1, w2 int
	svc.repo.db.Get(&w1, `SELECT used_weight FROM spools WHERE id = ?`, s1)
	svc.repo.db.Get(&w2, `SELECT used_weight FROM spools WHERE id = ?`, s2)
	if w1 != 0 {
		t.Errorf("DeletePrint(restoreSpoolGrams=true) s1 used_weight = %d, want 0", w1)
	}
	if w2 != 0 {
		t.Errorf("DeletePrint(restoreSpoolGrams=true) s2 used_weight = %d, want 0", w2)
	}
}

// --- computeSHA256 Tests ---

// new
func TestComputeSHA256(t *testing.T) {
	data := []byte("hello world")
	got := computeSHA256(data)
	want := "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"

	if len(got) != 64 {
		t.Errorf("computeSHA256() len = %d, want 64", len(got))
	}
	if got != want {
		t.Errorf("computeSHA256() = %q, want %q", got, want)
	}
	if got != computeSHA256(data) {
		t.Error("computeSHA256() is not deterministic")
	}
}

func TestComputeSHA256_DifferentInputs(t *testing.T) {
	h1 := computeSHA256([]byte("foo"))
	h2 := computeSHA256([]byte("bar"))
	if h1 == h2 {
		t.Error("computeSHA256() different inputs produced same hash")
	}
}

// --- UploadPrintModel Tests ---

func TestUploadPrintModel_NewModel(t *testing.T) {
	svc := newTestPrintService(t)
	id, _ := svc.CreatePrint(validPrint())

	data := []byte("fake stl content")
	err := svc.UploadPrintModel(id, "mymodel", "stl", int64(len(data)), data)
	if err != nil {
		t.Fatalf("UploadPrintModel() error: %v", err)
	}

	models, err := svc.GetPrintModels(id)
	if err != nil {
		t.Fatalf("GetPrintModels() error: %v", err)
	}
	if len(models) != 1 {
		t.Errorf("GetPrintModels() len = %d, want 1", len(models))
	}
	if models[0].Name != "mymodel" {
		t.Errorf("GetPrintModels() name = %q, want %q", models[0].Name, "mymodel")
	}
}

func TestUploadPrintModel_DeduplicateByHash(t *testing.T) {
	svc := newTestPrintService(t)

	p1id, _ := svc.CreatePrint(validPrint())
	p2id, _ := svc.CreatePrint(validPrint())

	data := []byte("same content")

	if err := svc.UploadPrintModel(p1id, "model", "stl", int64(len(data)), data); err != nil {
		t.Fatalf("first UploadPrintModel() error: %v", err)
	}
	if err := svc.UploadPrintModel(p2id, "model", "stl", int64(len(data)), data); err != nil {
		t.Fatalf("second UploadPrintModel() error: %v", err)
	}

	// Only one model record should exist (deduplication by hash)
	var count int
	svc.repo.db.Get(&count, `SELECT COUNT(*) FROM models`)
	if count != 1 {
		t.Errorf("model deduplication: models count = %d, want 1", count)
	}
}

// --- DeletePrintModel Tests ---

func TestDeletePrintModel_OrphanedModelDeleted(t *testing.T) {
	svc := newTestPrintService(t)
	id, _ := svc.CreatePrint(validPrint())

	data := []byte("content to delete")
	svc.UploadPrintModel(id, "toDelete", "stl", int64(len(data)), data)

	models, _ := svc.GetPrintModels(id)
	modelID := models[0].ID

	if err := svc.DeletePrintModel(id, modelID); err != nil {
		t.Fatalf("DeletePrintModel() error: %v", err)
	}

	var count int
	svc.repo.db.Get(&count, `SELECT COUNT(*) FROM models WHERE id = ?`, modelID)
	if count != 0 {
		t.Errorf("DeletePrintModel() orphaned model still in DB")
	}
}

func TestDeletePrintModel_SharedModelKept(t *testing.T) {
	svc := newTestPrintService(t)
	p1, _ := svc.CreatePrint(validPrint())
	p2, _ := svc.CreatePrint(validPrint())

	data := []byte("shared model data")
	svc.UploadPrintModel(p1, "shared", "stl", int64(len(data)), data)
	svc.UploadPrintModel(p2, "shared", "stl", int64(len(data)), data) // same hash → reuse

	models, _ := svc.GetPrintModels(p1)
	modelID := models[0].ID

	// Unlink from p1 only - model is still referenced by p2
	if err := svc.DeletePrintModel(p1, modelID); err != nil {
		t.Fatalf("DeletePrintModel() error: %v", err)
	}

	var count int
	svc.repo.db.Get(&count, `SELECT COUNT(*) FROM models WHERE id = ?`, modelID)
	if count != 1 {
		t.Errorf("DeletePrintModel() deleted shared model that is still referenced")
	}
}

// --- DuplicatePrintModel Tests ---

func TestDuplicatePrintModel(t *testing.T) {
	svc := newTestPrintService(t)
	p1, _ := svc.CreatePrint(validPrint())
	p2, _ := svc.CreatePrint(validPrint())

	data := []byte("model data")
	svc.UploadPrintModel(p1, "mymodel", "3mf", int64(len(data)), data)

	models, _ := svc.GetPrintModels(p1)
	modelID := models[0].ID

	if err := svc.DuplicatePrintModel(p2, modelID); err != nil {
		t.Fatalf("DuplicatePrintModel() error: %v", err)
	}

	p2models, _ := svc.GetPrintModels(p2)
	if len(p2models) != 1 {
		t.Errorf("DuplicatePrintModel() p2 model count = %d, want 1", len(p2models))
	}
	if p2models[0].ID != modelID {
		t.Errorf("DuplicatePrintModel() model id = %d, want %d", p2models[0].ID, modelID)
	}
}

// --- first_used_at / last_used_at Tests ---

func TestCreatePrint_SetsFirstUsedAt(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-T08")

	p := validPrint()
	p.Spools = []PrintSpool{{SpoolID: spoolID, GramsUsed: 10}}
	svc.CreatePrint(p)

	var firstUsedAt *time.Time
	svc.repo.db.Get(&firstUsedAt, `SELECT first_used_at FROM spools WHERE id = ?`, spoolID)
	if firstUsedAt == nil {
		t.Error("CreatePrint() first_used_at was not set on spool")
	}
}

// --- QueryPrints Tests ---

func insertPrint(t *testing.T, svc *PrintService, name, status string) int64 {
	t.Helper()
	result, err := svc.repo.db.Exec(`
		INSERT INTO prints (name, status, notes, created_at, updated_at)
		VALUES (?, ?, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		name, status,
	)
	if err != nil {
		t.Fatalf("insertPrint(%q) error: %v", name, err)
	}
	id, _ := result.LastInsertId()
	return id
}

func linkSpoolToPrint(t *testing.T, svc *PrintService, printID, spoolID int64) {
	t.Helper()
	_, err := svc.repo.db.Exec(`
		INSERT INTO print_spools (print_id, spool_id, grams_used, created_at, updated_at)
		VALUES (?, ?, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		printID, spoolID,
	)
	if err != nil {
		t.Fatalf("linkSpoolToPrint(%d, %d) error: %v", printID, spoolID, err)
	}
}

func TestQueryPrints_InvalidSortColumn(t *testing.T) {
	svc := newTestPrintService(t)
	svc.CreatePrint(validPrint())

	result, err := svc.QueryPrints(PrintQueryParams{SortBy: "'; DROP TABLE prints; --"})
	if err != nil {
		t.Fatalf("QueryPrints() error with bad sort column: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("QueryPrints() with bad sort column: total = %d, want 1", result.Total)
	}
}

func TestQueryPrints_StatusQualifier(t *testing.T) {
	svc := newTestPrintService(t)
	insertPrint(t, svc, "Benchy", "done")
	insertPrint(t, svc, "Vase", "printing")
	insertPrint(t, svc, "Bracket", "done")

	result, err := svc.QueryPrints(PrintQueryParams{Search: "status:done"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

// Multi-value status: status:done status:printing should return all three
func TestQueryPrints_StatusQualifier_MultiValue(t *testing.T) {
	svc := newTestPrintService(t)
	insertPrint(t, svc, "Benchy", "done")
	insertPrint(t, svc, "Vase", "printing")
	insertPrint(t, svc, "Bracket", "failed")

	result, err := svc.QueryPrints(PrintQueryParams{Search: "status:done status:printing"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

func TestQueryPrints_NameQualifier(t *testing.T) {
	svc := newTestPrintService(t)
	insertPrint(t, svc, "Benchy", "done")
	insertPrint(t, svc, "Vase", "done")

	result, err := svc.QueryPrints(PrintQueryParams{Search: "name:benchy"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("expected 1 result, got %d", result.Total)
	}
}

// Multi-value name: name:benchy name:vase should return both
func TestQueryPrints_NameQualifier_MultiValue(t *testing.T) {
	svc := newTestPrintService(t)
	insertPrint(t, svc, "Benchy", "done")
	insertPrint(t, svc, "Vase", "done")
	insertPrint(t, svc, "Bracket", "done")

	result, err := svc.QueryPrints(PrintQueryParams{Search: "name:benchy name:vase"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

func TestQueryPrints_SpoolQualifier_Exact(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-001")
	printID := insertPrint(t, svc, "Benchy", "done")
	insertPrint(t, svc, "Vase", "done") // not linked to any spool
	linkSpoolToPrint(t, svc, printID, spoolID)

	result, err := svc.QueryPrints(PrintQueryParams{Search: "spool:pla-red-001"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("expected 1 result, got %d", result.Total)
	}
	if result.Prints[0].Name != "Benchy" {
		t.Errorf("unexpected print: %s", result.Prints[0].Name)
	}
}

func TestQueryPrints_SpoolQualifier_Wildcard(t *testing.T) {
	svc := newTestPrintService(t)
	spoolA := insertTestSpool(t, svc, "PLA-RED-001")
	spoolB := insertTestSpool(t, svc, "PLA-BLU-002")
	printA := insertPrint(t, svc, "Benchy", "done")
	printB := insertPrint(t, svc, "Vase", "done")
	insertPrint(t, svc, "Bracket", "done") // no spool
	linkSpoolToPrint(t, svc, printA, spoolA)
	linkSpoolToPrint(t, svc, printB, spoolB)

	result, err := svc.QueryPrints(PrintQueryParams{Search: "spool:pla-*"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

// Multi-value spool: spool:pla-red-001 spool:pla-blu-002 should return both linked prints
func TestQueryPrints_SpoolQualifier_MultiValue(t *testing.T) {
	svc := newTestPrintService(t)
	spoolA := insertTestSpool(t, svc, "PLA-RED-001")
	spoolB := insertTestSpool(t, svc, "PLA-BLU-002")
	printA := insertPrint(t, svc, "Benchy", "done")
	printB := insertPrint(t, svc, "Vase", "done")
	insertPrint(t, svc, "Bracket", "done") // unlinked, should not appear
	linkSpoolToPrint(t, svc, printA, spoolA)
	linkSpoolToPrint(t, svc, printB, spoolB)

	result, err := svc.QueryPrints(PrintQueryParams{Search: "spool:pla-red-001 spool:pla-blu-002"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

// Multi-value spool wildcards: spool:pla-* spool:abs-* should match prints linked to either
func TestQueryPrints_SpoolQualifier_MultiWildcard(t *testing.T) {
	svc := newTestPrintService(t)
	spoolPLA := insertTestSpool(t, svc, "PLA-RED-001")
	spoolABS := insertTestSpool(t, svc, "ABS-BLU-002")
	printA := insertPrint(t, svc, "Benchy", "done")
	printB := insertPrint(t, svc, "Vase", "done")
	insertPrint(t, svc, "Bracket", "done") // no spool linked
	linkSpoolToPrint(t, svc, printA, spoolPLA)
	linkSpoolToPrint(t, svc, printB, spoolABS)

	result, err := svc.QueryPrints(PrintQueryParams{Search: "spool:pla-* spool:abs-*"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

// Different qualifier keys are ANDed — status:done + spool:pla-* should intersect
func TestQueryPrints_DifferentQualifiers_AND(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-001")
	printDone := insertPrint(t, svc, "Benchy", "done")
	printPrinting := insertPrint(t, svc, "Vase", "printing")
	linkSpoolToPrint(t, svc, printDone, spoolID)
	linkSpoolToPrint(t, svc, printPrinting, spoolID)

	result, err := svc.QueryPrints(PrintQueryParams{Search: "status:done spool:pla-red-001"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 1 {
		t.Errorf("expected 1 result, got %d", result.Total)
	}
	if result.Prints[0].Name != "Benchy" {
		t.Errorf("unexpected print: %s", result.Prints[0].Name)
	}
}

func TestQueryPrints_NoSearch(t *testing.T) {
	svc := newTestPrintService(t)
	insertPrint(t, svc, "Benchy", "done")
	insertPrint(t, svc, "Vase", "printing")

	result, err := svc.QueryPrints(PrintQueryParams{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 2 {
		t.Errorf("expected 2 results, got %d", result.Total)
	}
}

func TestQueryPrints_Empty(t *testing.T) {
	svc := newTestPrintService(t)
	insertPrint(t, svc, "Benchy", "done")

	result, err := svc.QueryPrints(PrintQueryParams{Search: "status:failed"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 0 {
		t.Errorf("expected 0 results, got %d", result.Total)
	}
}

func TestQueryPrints_Pagination(t *testing.T) {
	svc := newTestPrintService(t)
	for i := range 5 {
		insertPrint(t, svc, fmt.Sprintf("Print-%03d", i), "done")
	}

	result, err := svc.QueryPrints(PrintQueryParams{Limit: 2, Offset: 0})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Total != 5 {
		t.Errorf("expected total=5, got %d", result.Total)
	}
	if len(result.Prints) != 2 {
		t.Errorf("expected 2 prints on page, got %d", len(result.Prints))
	}
}

func TestQueryPrints_SpoolsLoaded(t *testing.T) {
	svc := newTestPrintService(t)
	spoolID := insertTestSpool(t, svc, "PLA-RED-001")
	printID := insertPrint(t, svc, "Benchy", "done")
	linkSpoolToPrint(t, svc, printID, spoolID)

	result, err := svc.QueryPrints(PrintQueryParams{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Prints) != 1 {
		t.Fatalf("expected 1 print, got %d", len(result.Prints))
	}
	if len(result.Prints[0].Spools) != 1 {
		t.Errorf("expected 1 spool loaded, got %d", len(result.Prints[0].Spools))
	}
}
