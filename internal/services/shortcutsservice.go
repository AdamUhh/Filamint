package services

import (
	"context"
	"fmt"
	"log/slog"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jmoiron/sqlx"
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
	db    *sqlx.DB
	cache map[string]Shortcut
	mu    sync.RWMutex

	app *application.App

	shortcutsEnabled atomic.Bool
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
	default:
		slog.Warn("unknown shortcut action", "action", action)
	}
}

func NewShortcutService(database *Database) *ShortcutService {
	s := &ShortcutService{
		db:    database.db,
		cache: make(map[string]Shortcut),
	}

	s.shortcutsEnabled.Store(true)

	return s
}

func (s *ShortcutService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	s.app = application.Get()

	if err := s.seedDefaultsIfEmpty(); err != nil {
		return err
	}
	if err := s.loadCache(); err != nil {
		return err
	}

	return s.registerShortcuts()
}

func (s *ShortcutService) seedDefaultsIfEmpty() error {
	var count int
	if err := s.db.Get(&count, `SELECT COUNT(1) FROM shortcuts`); err != nil {
		err = fmt.Errorf("failed to count shortcuts: %w", err)
		slog.Error(err.Error())
		return err
	}
	if count > 0 {
		return nil
	}

	tx, err := s.db.Beginx()
	if err != nil {
		err = fmt.Errorf("failed to begin transaction: %w", err)
		slog.Error(err.Error())
		return err
	}

	for _, shortcut := range getDefaultShortcuts() {
		_, err := tx.NamedExec(`
			INSERT INTO shortcuts (action, key_combo, description, category, dev_only)
			VALUES (:action, :key_combo, :description, :category, :dev_only)
		`, shortcut)
		if err != nil {
			_ = tx.Rollback()
			err = fmt.Errorf("failed to insert default shortcut '%s': %w", shortcut.Action, err)
			slog.Error(err.Error())
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		err = fmt.Errorf("failed to commit default shortcuts: %w", err)
		slog.Error(err.Error())
		return err
	}

	return nil
}

// populates the in-memory cache (once)
func (s *ShortcutService) loadCache() error {
	var shortcuts []Shortcut
	if err := s.db.Select(&shortcuts, `
		SELECT id, action, key_combo, description, category, dev_only, created_at, updated_at
		FROM shortcuts
		ORDER BY category, action
	`); err != nil {
		err = fmt.Errorf("failed to fetch shortcuts: %w", err)
		slog.Error(err.Error())
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.cache = make(map[string]Shortcut, len(shortcuts))
	for _, sc := range shortcuts {
		s.cache[sc.Action] = sc
	}

	return nil
}

func (s *ShortcutService) registerShortcuts() error {
	s.app.Event.On("shortcuts:set_enabled", func(e *application.CustomEvent) {
		if enabled, ok := e.Data.(bool); ok {
			s.shortcutsEnabled.Store(enabled)
		}
	})

	return s.registerShortcutsInternal()
}

func (s *ShortcutService) areShortcutsEnabled() bool {
	return s.shortcutsEnabled.Load()
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

// ----------
// CRUD
// ----------
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

func (s *ShortcutService) GetShortcutCombos(actions []string) []string {
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

	return combos
}

func (s *ShortcutService) GetAllShortcuts() ([]Shortcut, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	envInfo := s.app.Env.Info()

	shortcuts := make([]Shortcut, 0, len(s.cache))
	for _, shortcut := range s.cache {
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

	for action, shortcut := range s.cache {
		if shortcut.KeyCombo != newKeyCombo || action == excludeAction {
			continue
		}

		conflictsWith := s.categoriesConflict(currentCategory, shortcut.Category)
		if conflictsWith {
			return fmt.Errorf(
				"shortcut '%s' is already used by action '%s' (category: %s)",
				newKeyCombo, action, shortcut.Category,
			)
		}
	}

	return nil
}

// categoriesConflict returns true if two categories share a key binding namespace.
// Window shortcuts are global and conflict with every category.
// Otherwise, only shortcuts within the same category conflict.
func (s *ShortcutService) categoriesConflict(a, b string) bool {
	if a == "window" || b == "window" {
		return true
	}
	return a == b
}

func (s *ShortcutService) UpdateShortcut(action string, newKeyCombo string) error {
	newKeyCombo = strings.TrimSpace(newKeyCombo)
	if newKeyCombo == "" {
		err := fmt.Errorf("key combo cannot be empty")
		slog.Error(err.Error())
		return err
	}

	s.mu.RLock()
	currentShortcut, exists := s.cache[action]
	s.mu.RUnlock()

	if !exists {
		err := fmt.Errorf("shortcut with action '%s' not found", action)
		slog.Error(err.Error())
		return err
	}

	if err := s.checkDuplicateInCache(newKeyCombo, action, currentShortcut.Category); err != nil {
		slog.Error(err.Error())
		return err
	}

	s.mu.Lock()
	original := currentShortcut
	currentShortcut.KeyCombo = newKeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {
		err = fmt.Errorf("failed to sync to database: %w", err)
		slog.Error(err.Error())

		// Rollback cache on DB failure
		s.mu.Lock()
		s.cache[action] = original
		s.mu.Unlock()
		return err
	}

	if err := s.reloadShortcuts(); err != nil {
		slog.Error(err.Error())
		return err
	}

	return nil
}

func (s *ShortcutService) ResetShortcut(action string) error {
	defaults := getDefaultShortcuts()

	var defaultShortcut *Shortcut
	for i := range defaults {
		if defaults[i].Action == action {
			defaultShortcut = &defaults[i]
			break
		}
	}

	if defaultShortcut == nil {
		err := fmt.Errorf("no default shortcut found for action '%s'", action)
		slog.Error(err.Error())
		return err
	}

	s.mu.RLock()
	currentShortcut, exists := s.cache[action]
	s.mu.RUnlock()

	if !exists {
		err := fmt.Errorf("shortcut with action '%s' not found", action)
		slog.Error(err.Error())
		return err
	}

	s.mu.Lock()
	currentShortcut.KeyCombo = defaultShortcut.KeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {
		err = fmt.Errorf("failed to sync to database: %w", err)
		slog.Error(err.Error())
		return err
	}

	if err := s.reloadShortcuts(); err != nil {
		slog.Error(err.Error())
		return err
	}

	return nil
}

func (s *ShortcutService) ResetAllShortcuts() error {
	defaults := getDefaultShortcuts()
	updated := make([]Shortcut, 0, len(defaults))

	s.mu.Lock()
	for _, ds := range defaults {
		if cur, exists := s.cache[ds.Action]; exists {
			cur.KeyCombo = ds.KeyCombo
			cur.UpdatedAt = time.Now()
			s.cache[ds.Action] = cur
			updated = append(updated, cur)
		}
	}
	s.mu.Unlock()

	for _, shortcut := range updated {
		if err := s.syncCacheToDatabase(shortcut); err != nil {
			err = fmt.Errorf("failed to sync shortcut '%s' to database: %w", shortcut.Action, err)
			slog.Error(err.Error())
			return err
		}
	}

	if err := s.reloadShortcuts(); err != nil {
		slog.Error(err.Error())
		return err
	}

	return nil
}

func (s *ShortcutService) ServiceShutdown() error {
	return nil
}
