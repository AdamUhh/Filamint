package shortcuts

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

func newTestStore(t *testing.T) *ShortcutStore {
	t.Helper()
	db := sqlx.MustConnect("sqlite", ":memory:")
	db.MustExec(`CREATE TABLE shortcuts (
	    id INTEGER PRIMARY KEY AUTOINCREMENT,
	    action TEXT NOT NULL UNIQUE,
	    key_combo TEXT NOT NULL,
	    description TEXT NOT NULL DEFAULT '',
	    category TEXT NOT NULL,
	    dev_only INTEGER NOT NULL DEFAULT 0,
	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	store := NewShortcutStore(db)
	require.NoError(t, store.Init())
	return store
}

// Conflict detection

func TestCategoriesConflict(t *testing.T) {
	assert.True(t, categoriesConflict("window", "spool"), "window conflicts with everything")
	assert.True(t, categoriesConflict("spool", "window"))
	assert.True(t, categoriesConflict("spool", "spool"), "same category conflicts")
	assert.False(t, categoriesConflict("spool", "print"), "different non-window categories don't conflict")
}

func TestCheckDuplicate_NoConflict(t *testing.T) {
	store := newTestStore(t)
	// spool and print share Ctrl+N but don't conflict with each other
	err := store.CheckDuplicate("Ctrl+N", "spool:create", "spool", false)
	assert.NoError(t, err)
}

func TestCheckDuplicate_WindowConflict(t *testing.T) {
	store := newTestStore(t)
	// Trying to assign F11 (a window shortcut) to a spool action should conflict
	err := store.CheckDuplicate("F11", "spool:create", "spool", false)
	assert.Error(t, err)
}

func TestCheckDuplicate_ExcludesSelf(t *testing.T) {
	store := newTestStore(t)
	// updating a shortcut to its own current combo should not be an error
	err := store.CheckDuplicate("F11", "window:fullscreen", "window", false)
	assert.NoError(t, err)
}

func TestCheckDuplicate_DevOnlyIgnoredInProdMode(t *testing.T) {
	store := newTestStore(t)
	// F12 is dev-only - in prod mode it shouldn't block anything
	err := store.CheckDuplicate("F12", "spool:create", "spool", false)
	assert.NoError(t, err)
}

func TestCheckDuplicate_DevOnlyBlocksInDevMode(t *testing.T) {
	store := newTestStore(t)
	// same combo, but now we're in dev mode - F12 is visible and should conflict
	err := store.CheckDuplicate("F12", "spool:create", "spool", true)
	assert.Error(t, err)
}

// Update

func TestUpdate_UnknownAction(t *testing.T) {
	store := newTestStore(t)
	err := store.Update("nonexistent:action", "Ctrl+X")
	assert.Error(t, err)
}

func TestUpdate_EmptyCombo(t *testing.T) {
	store := newTestStore(t)
	err := store.Update("window:fullscreen", "")
	assert.Error(t, err)
}

func TestUpdate_PersistsToDatabase(t *testing.T) {
	store := newTestStore(t)
	require.NoError(t, store.Update("window:fullscreen", "F10"))

	// reload a fresh store from the same DB - change must survive
	store2 := NewShortcutStore(store.db)
	require.NoError(t, store2.Init())
	assert.Equal(t, "F10", store2.Combo("window:fullscreen"))
}

func TestUpdate_RollbackOnDBFailure(t *testing.T) {
	store := newTestStore(t)
	store.db.MustExec(`DROP TABLE shortcuts`) // sabotage DB

	err := store.Update("window:fullscreen", "F10")
	assert.Error(t, err)

	// Cache must be rolled back - combo is still F11
	assert.Equal(t, "F11", store.Combo("window:fullscreen"))
}

func TestUpdate_UpdatedAtChanges(t *testing.T) {
	store := newTestStore(t)
	before := store.cache["window:fullscreen"].UpdatedAt

	time.Sleep(time.Millisecond) // ensure time advances
	require.NoError(t, store.Update("window:fullscreen", "F10"))

	after := store.cache["window:fullscreen"].UpdatedAt
	assert.True(t, after.After(before), "UpdatedAt should advance after an update")
}

// Reset

func TestResetOne_UnknownAction(t *testing.T) {
	store := newTestStore(t)
	err := store.ResetOne("nonexistent:action")
	assert.Error(t, err)
}

func TestResetOne_RestoresDefaultCombo(t *testing.T) {
	store := newTestStore(t)
	require.NoError(t, store.Update("window:fullscreen", "F10"))
	require.NoError(t, store.ResetOne("window:fullscreen"))
	assert.Equal(t, "F11", store.Combo("window:fullscreen"))
}

func TestResetOne_PersistsToDatabase(t *testing.T) {
	store := newTestStore(t)
	require.NoError(t, store.Update("window:fullscreen", "F10"))
	require.NoError(t, store.ResetOne("window:fullscreen"))

	store2 := NewShortcutStore(store.db)
	require.NoError(t, store2.Init())
	assert.Equal(t, "F11", store2.Combo("window:fullscreen"))
}

func TestResetAll(t *testing.T) {
	store := newTestStore(t)
	require.NoError(t, store.Update("window:fullscreen", "F10"))
	require.Equal(t, "F10", store.Combo("window:fullscreen"))

	require.NoError(t, store.ResetAll())
	assert.Equal(t, "F11", store.Combo("window:fullscreen"))
}

func TestResetAll_PartialFailureRollsBackCache(t *testing.T) {
	store := newTestStore(t)
	require.NoError(t, store.Update("window:fullscreen", "F10"))
	store.db.MustExec(`DROP TABLE shortcuts`) // sabotage mid-reset

	err := store.ResetAll()
	assert.Error(t, err)
	// cache must be back to F10, not the default F11
	assert.Equal(t, "F10", store.Combo("window:fullscreen"))
}

// Query / read

func TestCombo_UnknownActionReturnsEmpty(t *testing.T) {
	store := newTestStore(t)
	assert.Equal(t, "", store.Combo("nonexistent:action"))
}

func TestAll_HidesDevOnlyInProdMode(t *testing.T) {
	store := newTestStore(t)
	shortcuts := store.All(false)
	for _, sc := range shortcuts {
		assert.False(t, sc.DevOnly, "prod mode should not return dev-only shortcut %q", sc.Action)
	}
}

func TestAll_ShowsDevOnlyInDevMode(t *testing.T) {
	store := newTestStore(t)
	shortcuts := store.All(true)
	actions := make([]string, 0, len(shortcuts))
	for _, sc := range shortcuts {
		actions = append(actions, sc.Action)
	}
	assert.Contains(t, actions, "window:devtools")
	assert.Contains(t, actions, "window:reload")
}
