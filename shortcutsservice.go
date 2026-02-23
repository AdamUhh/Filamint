package main

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"
)

type Shortcut struct {
	ID          int64     `db:"id" json:"id"`
	Action      string    `db:"action" json:"action"`
	KeyCombo    string    `db:"key_combo" json:"keyCombo"`
	Description string    `db:"description" json:"description"`
	Category    string    `db:"category" json:"category"`
	DevOnly     bool      `db:"dev_only" json:"devOnly"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

type ShortcutService struct {
	db    *Database
	cache map[string]Shortcut
	mu    sync.RWMutex
}

func getModifierKey() string {
	if runtime.GOOS == "darwin" {
		return "Cmd+"
	}
	return "Ctrl+"
}

func getDefaultShortcuts() []Shortcut {
	Ctrl := getModifierKey()

	return []Shortcut{
		// Window shortcuts
		{
			Action:      "window:fullscreen",
			KeyCombo:    "F11",
			Description: "Toggle fullscreen",
			Category:    "window",
		},
		{
			Action:      "window:devtools",
			KeyCombo:    "F12",
			Description: "Open developer tools",
			Category:    "window",
			DevOnly:     true,
		},
		{
			Action:      "window:reload",
			KeyCombo:    Ctrl + "R",
			Description: "Reload window",
			Category:    "window",
			DevOnly:     true,
		},

		// Spool shortcuts
		{
			Action:      "spool:toggle_template",
			KeyCombo:    Ctrl + "T",
			Description: "Toggle template mode",
			Category:    "spool",
		},
		{
			Action:      "spool:create",
			KeyCombo:    Ctrl + "N",
			Description: "Create new spool",
			Category:    "spool",
		},
		{
			Action:      "spool:redirect",
			KeyCombo:    Ctrl + "Shift+S",
			Description: "Go to spools page",
			Category:    "spool",
		},

		// Print shortcuts
		{
			Action:      "print:redirect",
			KeyCombo:    Ctrl + "Shift+P",
			Description: "Go to prints page",
			Category:    "print",
		},
		{
			Action:      "print:create",
			KeyCombo:    Ctrl + "N",
			Description: "Create new print",
			Category:    "print",
		},
	}
}

func NewShortcutService(db *Database) *ShortcutService {
	service := &ShortcutService{
		db:    db,
		cache: make(map[string]Shortcut),
	}

	if err := service.initialize(); err != nil {
		fmt.Printf("Warning: failed to initialize shortcuts: %v\n", err)
	}

	return service
}

func (s *ShortcutService) initialize() error {
	var count int
	if err := s.db.Get(&count, `SELECT COUNT(1) FROM shortcuts`); err != nil {
		return err
	}

	// If database is empty, insert defaults
	if count == 0 {
		defaults := getDefaultShortcuts()
		for _, shortcut := range defaults {
			_, err := s.db.db.NamedExec(`
				INSERT INTO shortcuts (action, key_combo, description, category, dev_only)
				VALUES (:action, :key_combo, :description, :category, :dev_only)
			`, shortcut)
			if err != nil {
				return err
			}
		}
	}

	// Load all shortcuts from database into cache (ONLY HAPPENS ONCE)
	var shortcuts []Shortcut
	err := s.db.Select(&shortcuts, `
		SELECT id, action, key_combo, description, category, dev_only, created_at, updated_at
		FROM shortcuts
		ORDER BY category, action
	`)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.cache = make(map[string]Shortcut)
	for _, shortcut := range shortcuts {
		s.cache[shortcut.Action] = shortcut
	}

	return nil
}

func (s *ShortcutService) syncCacheToDatabase(shortcut Shortcut) error {
	_, err := s.db.Exec(`
		UPDATE shortcuts
		SET key_combo = ?, updated_at = CURRENT_TIMESTAMP
		WHERE action = ?
	`, shortcut.KeyCombo, shortcut.Action)
	return err
}

func (s *ShortcutService) reloadShortcuts() error {
	if shortcutRegistrar != nil {
		if err := shortcutRegistrar.reloadShortcuts(s); err != nil {
			return fmt.Errorf("failed to reload shortcuts: %w", err)
		}
	}
	return nil
}

func (s *ShortcutService) GetShortcutCombo(action string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if shortcut, exists := s.cache[action]; exists {
		return shortcut.KeyCombo, nil
	}

	return "", nil // Return empty string for not found
}

func (s *ShortcutService) GetShortcutCombos(actions []string) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	combos := make([]string, 0, len(actions))

	for _, action := range actions {
		if shortcut, exists := s.cache[action]; exists {
			combos = append(combos, shortcut.KeyCombo)
		} else {
			combos = append(combos, "")
		}
	}

	return combos, nil
}

func (s *ShortcutService) GetAllShortcuts() ([]Shortcut, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	shortcuts := make([]Shortcut, 0, len(s.cache))
	for _, shortcut := range s.cache {
		shortcuts = append(shortcuts, shortcut)
	}

	return shortcuts, nil
}

func (s *ShortcutService) checkDuplicateInCache(newKeyCombo, excludeAction string, currentCategory string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Window category: no duplicates allowed at all
	if currentCategory == "window" {
		for action, shortcut := range s.cache {
			if shortcut.KeyCombo == newKeyCombo && action != excludeAction {
				return fmt.Errorf("shortcut '%s' is already used by action '%s' in category '%s'",
					newKeyCombo, action, shortcut.Category)
			}
		}
	} else {
		// For non-window categories, check duplicates within same category
		for action, shortcut := range s.cache {
			if shortcut.KeyCombo == newKeyCombo && action != excludeAction {
				if shortcut.Category == currentCategory {
					return fmt.Errorf("shortcut '%s' is already used by action '%s' in the same category '%s'",
						newKeyCombo, action, currentCategory)
				}
				// Also check if this key combo is used by window category (window bindings are global)
				if shortcut.Category == "window" {
					return fmt.Errorf("shortcut '%s' is already used by window action '%s' (window shortcuts are global)",
						newKeyCombo, action)
				}
			}
		}
	}

	return nil
}

func (s *ShortcutService) UpdateShortcut(action string, newKeyCombo string) error {
	// Normalize key combo
	newKeyCombo = strings.TrimSpace(newKeyCombo)
	if newKeyCombo == "" {
		return fmt.Errorf("key combo cannot be empty")
	}

	s.mu.RLock()
	currentShortcut, exists := s.cache[action]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("shortcut with action '%s' not found", action)
	}

	if err := s.checkDuplicateInCache(newKeyCombo, action, currentShortcut.Category); err != nil {
		return err
	}

	// Update cache
	s.mu.Lock()
	original := currentShortcut
	currentShortcut.KeyCombo = newKeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {
		s.mu.Lock()
		s.cache[action] = original // Restore original
		s.mu.Unlock()
		return fmt.Errorf("failed to sync to database: %w", err)
	}

	if err := s.reloadShortcuts(); err != nil {
		return err
	}

	return nil
}

func (s *ShortcutService) ResetShortcut(action string) error {
	defaults := getDefaultShortcuts()

	var defaultShortcut *Shortcut
	for _, ds := range defaults {
		if ds.Action == action {
			defaultShortcut = &ds
			break
		}
	}

	if defaultShortcut == nil {
		return fmt.Errorf("no default shortcut found for action '%s'", action)
	}

	s.mu.RLock()
	currentShortcut, exists := s.cache[action]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("shortcut with action '%s' not found", action)
	}

	s.mu.Lock()
	currentShortcut.KeyCombo = defaultShortcut.KeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {
		return fmt.Errorf("failed to sync to database: %w", err)
	}

	if err := s.reloadShortcuts(); err != nil {
		return err
	}

	return nil
}

func (s *ShortcutService) ResetAllShortcuts() error {
	defaults := getDefaultShortcuts()

	s.mu.Lock()
	for _, defaultShortcut := range defaults {
		if currentShortcut, exists := s.cache[defaultShortcut.Action]; exists {
			currentShortcut.KeyCombo = defaultShortcut.KeyCombo
			currentShortcut.UpdatedAt = time.Now()
			s.cache[defaultShortcut.Action] = currentShortcut
		}
	}
	s.mu.Unlock()

	// Sync all to database
	for _, defaultShortcut := range defaults {
		if shortcut, exists := s.cache[defaultShortcut.Action]; exists {
			if err := s.syncCacheToDatabase(shortcut); err != nil {
				return fmt.Errorf("failed to sync shortcut '%s' to database: %w", shortcut.Action, err)
			}
		}
	}

	if err := s.reloadShortcuts(); err != nil {
		return err
	}

	return nil
}

// func (s *ShortcutService) GetShortcutsByCategory(category string) ([]Shortcut, error) {
// 	s.mu.RLock()
// 	defer s.mu.RUnlock()
//
// 	shortcuts := make([]Shortcut, 0)
// 	for _, shortcut := range s.cache {
// 		if shortcut.Category == category {
// 			shortcuts = append(shortcuts, shortcut)
// 		}
// 	}
//
// 	return shortcuts, nil
// }

// getShortcutByAction returns a single shortcut by action from cache
// func (s *ShortcutService) getShortcutByAction(action string) (Shortcut, error) {
// 	s.mu.RLock()
// 	defer s.mu.RUnlock()
//
// 	if shortcut, exists := s.cache[action]; exists {
// 		return shortcut, nil
// 	}
//
// 	return Shortcut{}, fmt.Errorf("shortcut with action '%s' not found", action)
// }
