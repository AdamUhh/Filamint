package main

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
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
	db               *Database
	cache            map[string]Shortcut
	mu               sync.RWMutex
	app              *application.App
	shortcutsEnabled bool
	registrarMu      sync.RWMutex
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
		db:               db,
		cache:            make(map[string]Shortcut),
		shortcutsEnabled: true,
	}

	if err := service.initialize(); err != nil {
		fmt.Printf("Warning: failed to initialize shortcuts: %v\n", err)
	}

	return service
}

func (s *ShortcutService) setApp(app *application.App) {
	s.app = app
}

func (s *ShortcutService) initialize() error {
	var count int
	if err := s.db.Get(&count, `SELECT COUNT(1) FROM shortcuts`); err != nil {
		return err
	}

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

func (s *ShortcutService) registerShortcuts() error {
	s.app.Event.On("shortcuts:set_enabled", func(e *application.CustomEvent) {
		if enabled, ok := e.Data.(bool); ok {
			s.registrarMu.Lock()
			s.shortcutsEnabled = enabled
			s.registrarMu.Unlock()
		}
	})

	return s.registerShortcutsInternal()
}

func (s *ShortcutService) areShortcutsEnabled() bool {
	s.registrarMu.RLock()
	defer s.registrarMu.RUnlock()
	return s.shortcutsEnabled
}

func (s *ShortcutService) reloadShortcuts() error {
	existingBindings := s.app.KeyBinding.GetAll()
	for _, binding := range existingBindings {
		s.app.KeyBinding.Remove(binding.Accelerator)
	}

	if err := s.registerShortcutsInternal(); err != nil {
		return err
	}

	for _, window := range s.app.Window.GetAll() {
		window.EmitEvent("window:reload_shortcuts", nil)
	}

	return nil
}

func (s *ShortcutService) registerShortcutsInternal() error {
	shortcuts, err := s.GetAllShortcuts()
	if err != nil {
		return fmt.Errorf("failed to load shortcuts: %w", err)
	}

	envInfo := s.app.Env.Info()

	keyComboMap := make(map[string][]Shortcut)
	for _, shortcut := range shortcuts {
		// hide devonly shortcuts in production
		if shortcut.DevOnly && !envInfo.Debug {
			continue
		}
		keyComboMap[shortcut.KeyCombo] = append(keyComboMap[shortcut.KeyCombo], shortcut)
	}

	for keyCombo, shortcuts := range keyComboMap {
		shortcutsCopy := shortcuts
		s.app.KeyBinding.Add(keyCombo, func(window application.Window) {
			if !s.areShortcutsEnabled() {
				return
			}
			for _, shortcut := range shortcutsCopy {
				executeShortcutAction(window, shortcut.Action)
			}
		})
	}

	return nil
}

func executeShortcutAction(window application.Window, action string) {
	switch action {
	case "window:fullscreen":
		window.ToggleFullscreen()
	case "window:devtools":
		window.OpenDevTools()
	case "window:reload":
		window.Reload()
	case "spool:toggle_template":
		window.EmitEvent("spool:toggle_template", nil)
	case "spool:create":
		window.EmitEvent("spool:create", nil)
	case "spool:redirect":
		window.EmitEvent("spool:redirect", nil)
	case "print:redirect":
		window.EmitEvent("print:redirect", nil)
	case "print:create":
		window.EmitEvent("print:create", nil)
	}
}

func (s *ShortcutService) syncCacheToDatabase(shortcut Shortcut) error {
	_, err := s.db.Exec(`
		UPDATE shortcuts
		SET key_combo = ?, updated_at = CURRENT_TIMESTAMP
		WHERE action = ?
	`, shortcut.KeyCombo, shortcut.Action)
	return err
}

func (s *ShortcutService) GetShortcutCombo(action string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if shortcut, exists := s.cache[action]; exists {
		return shortcut.KeyCombo, nil
	}

	return "", nil
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

	envInfo := s.app.Env.Info()

	shortcuts := make([]Shortcut, 0, len(s.cache))
	for _, shortcut := range s.cache {
		// hide devonly shortcuts in production
		if shortcut.DevOnly && !envInfo.Debug {
			continue
		}
		shortcuts = append(shortcuts, shortcut)
	}

	return shortcuts, nil
}

func (s *ShortcutService) checkDuplicateInCache(newKeyCombo, excludeAction string, currentCategory string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if currentCategory == "window" {
		for action, shortcut := range s.cache {
			if shortcut.KeyCombo == newKeyCombo && action != excludeAction {
				return fmt.Errorf("shortcut '%s' is already used by action '%s' in category '%s'",
					newKeyCombo, action, shortcut.Category)
			}
		}
	} else {
		for action, shortcut := range s.cache {
			if shortcut.KeyCombo == newKeyCombo && action != excludeAction {
				if shortcut.Category == currentCategory {
					return fmt.Errorf("shortcut '%s' is already used by action '%s' in the same category '%s'",
						newKeyCombo, action, currentCategory)
				}
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

	s.mu.Lock()
	original := currentShortcut
	currentShortcut.KeyCombo = newKeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {
		s.mu.Lock()
		s.cache[action] = original
		s.mu.Unlock()
		return fmt.Errorf("failed to sync to database: %w", err)
	}

	return s.reloadShortcuts()
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

	return s.reloadShortcuts()
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

	for _, defaultShortcut := range defaults {
		if shortcut, exists := s.cache[defaultShortcut.Action]; exists {
			if err := s.syncCacheToDatabase(shortcut); err != nil {
				return fmt.Errorf("failed to sync shortcut '%s' to database: %w", shortcut.Action, err)
			}
		}
	}

	return s.reloadShortcuts()
}
