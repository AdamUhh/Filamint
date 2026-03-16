package shortcuts

import (
	"fmt"
	"maps"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
)

// ShortcutStore owns the in-memory cache and all DB mutations.
// It has no knowledge of Wails - fully unit-testable.
type ShortcutStore struct {
	db    *sqlx.DB
	cache map[string]Shortcut
	mu    sync.RWMutex
}

func NewShortcutStore(db *sqlx.DB) *ShortcutStore {
	return &ShortcutStore{
		db:    db,
		cache: make(map[string]Shortcut),
	}
}

// Init seeds defaults (if the table is empty) and populates the cache.
// Call once at startup before any reads or writes.
func (s *ShortcutStore) Init() error {
	if err := s.seedDefaultsIfEmpty(); err != nil {
		return err
	}
	return s.loadCache()
}

func (s *ShortcutStore) seedDefaultsIfEmpty() error {
	var count int
	if err := s.db.Get(&count, `SELECT COUNT(1) FROM shortcuts`); err != nil {
		return fmt.Errorf("count shortcuts: %w", err)
	}
	if count > 0 {
		return nil
	}

	tx, err := s.db.Beginx()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	for _, sc := range DefaultShortcuts() {
		if _, err := tx.NamedExec(`
			INSERT INTO shortcuts (action, key_combo, description, category, dev_only)
			VALUES (:action, :key_combo, :description, :category, :dev_only)
		`, sc); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("insert default %q: %w", sc.Action, err)
		}
	}
	return tx.Commit()
}

func (s *ShortcutStore) loadCache() error {
	var shortcuts []Shortcut
	if err := s.db.Select(&shortcuts, `
		SELECT id, action, key_combo, description, category, dev_only, created_at, updated_at
		FROM shortcuts ORDER BY category, action
	`); err != nil {
		return fmt.Errorf("fetch shortcuts: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache = make(map[string]Shortcut, len(shortcuts))
	for _, sc := range shortcuts {
		s.cache[sc.Action] = sc
	}
	return nil
}

// All returns every shortcut in the cache, optionally filtered by devMode.
func (s *ShortcutStore) All(devMode bool) []Shortcut {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Shortcut, 0, len(s.cache))
	for _, sc := range s.cache {
		if sc.DevOnly && !devMode {
			continue
		}
		out = append(out, sc)
	}
	return out
}

// Combo returns the key combo for an action, or "" if not found.
func (s *ShortcutStore) Combo(action string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cache[action].KeyCombo
}

// Combos returns key combos for a slice of actions, preserving order.
// Missing actions produce an empty string at the same index.
func (s *ShortcutStore) Combos(actions []string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, len(actions))
	for i, a := range actions {
		out[i] = s.cache[a].KeyCombo
	}
	return out
}

// CheckDuplicate returns an error if newKeyCombo is already claimed by
// a different action whose category conflicts with currentCategory.
func (s *ShortcutStore) CheckDuplicate(newKeyCombo, excludeAction, currentCategory string, devMode bool) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for action, sc := range s.cache {
		if sc.DevOnly && !devMode {
			continue
		}
		if sc.KeyCombo != newKeyCombo || action == excludeAction {
			continue
		}
		if categoriesConflict(currentCategory, sc.Category) {
			return fmt.Errorf("combo %q already used by %q (category: %s)", newKeyCombo, action, sc.Category)
		}
	}
	return nil
}

// Update changes a shortcut's key combo in cache and DB atomically.
// On DB failure, the cache is rolled back.
func (s *ShortcutStore) Update(action, newKeyCombo string) error {
	s.mu.RLock()
	cur, ok := s.cache[action]
	s.mu.RUnlock()
	if !ok {
		return fmt.Errorf("action %q not found", action)
	}

	original := cur
	cur.KeyCombo = newKeyCombo
	cur.UpdatedAt = time.Now()

	s.mu.Lock()
	s.cache[action] = cur
	s.mu.Unlock()

	if err := s.syncToDB(cur); err != nil {
		s.mu.Lock()
		s.cache[action] = original
		s.mu.Unlock()
		return fmt.Errorf("sync to db: %w", err)
	}
	return nil
}

// ResetOne restores a single shortcut to its default key combo.
func (s *ShortcutStore) ResetOne(action string) error {
	def, ok := defaultByAction(action)
	if !ok {
		return fmt.Errorf("no default for action %q", action)
	}
	return s.Update(action, def.KeyCombo)
}

// ResetAll restores all defaults in a single DB transaction.
func (s *ShortcutStore) ResetAll() error {
	defaults := DefaultShortcuts()

	s.mu.Lock()
	originals := make(map[string]Shortcut, len(defaults))
	toWrite := make([]Shortcut, 0, len(defaults))
	for _, d := range defaults {
		if cur, ok := s.cache[d.Action]; ok {
			originals[d.Action] = cur
			cur.KeyCombo = d.KeyCombo
			cur.UpdatedAt = time.Now()
			s.cache[d.Action] = cur
			toWrite = append(toWrite, cur)
		}
	}
	s.mu.Unlock()

	tx, err := s.db.Beginx()
	if err != nil {
		s.mu.Lock()
		maps.Copy(s.cache, originals)
		s.mu.Unlock()
		return fmt.Errorf("begin tx: %w", err)
	}
	for _, sc := range toWrite {
		if _, err := tx.Exec(`UPDATE shortcuts SET key_combo=?, updated_at=CURRENT_TIMESTAMP WHERE action=?`,
			sc.KeyCombo, sc.Action); err != nil {
			_ = tx.Rollback()
			s.mu.Lock()
			maps.Copy(s.cache, originals)
			s.mu.Unlock()
			return fmt.Errorf("reset %q: %w", sc.Action, err)
		}
	}
	if err := tx.Commit(); err != nil {
		s.mu.Lock()
		maps.Copy(s.cache, originals)
		s.mu.Unlock()
		return fmt.Errorf("commit reset: %w", err)
	}
	return nil
}

func (s *ShortcutStore) syncToDB(sc Shortcut) error {
	_, err := s.db.Exec(`UPDATE shortcuts SET key_combo=?, updated_at=CURRENT_TIMESTAMP WHERE action=?`,
		sc.KeyCombo, sc.Action)
	return err
}

// categoriesConflict is pure logic - exported for testing.
func categoriesConflict(a, b string) bool {
	return a == "window" || b == "window" || a == b
}

func defaultByAction(action string) (Shortcut, bool) {
	for _, d := range DefaultShortcuts() {
		if d.Action == action {
			return d, true
		}
	}
	return Shortcut{}, false
}
