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

	windowCategories   map[string][]string
	windowCategoriesMu sync.RWMutex
}

var modifierKey = func() string {
	if runtime.GOOS == "darwin" {
		return "Cmd+"
	}
	return "Ctrl+"
}()

var routeCategoryMap = map[string][]string{
	"/":       {"window"},
	"/spools": {"window", "spool", "print"},
	"/prints": {"window", "spool", "print"},
}

func isCategoryAllowed(category string, allowed []string) bool {
	for _, c := range allowed {
		if c == category {
			return true
		}
	}
	return false
}

func getDefaultShortcuts() []Shortcut {
	Ctrl := modifierKey

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
	var windowID = fmt.Sprintf("window-%d", window.ID())

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
		window.EmitEvent("spool:redirect", windowID)
	case "print:redirect":
		window.EmitEvent("print:redirect", windowID)
	case "print:create":
		window.EmitEvent("print:create", nil)
	default:
		slog.Warn("unknown shortcut action", "action", action)
	}
}

func NewShortcutService(database *Database) *ShortcutService {
	s := &ShortcutService{
		db:               database.db,
		cache:            make(map[string]Shortcut),
		windowCategories: make(map[string][]string),
	}

	s.shortcutsEnabled.Store(true)

	return s
}

func (s *ShortcutService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	slog.Info("Shortcut service started")
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
		slog.Error("failed to count shortcuts", "error", err)
		return fmt.Errorf("failed to count shortcuts: %w", err)
	}
	if count > 0 {
		return nil
	}

	tx, err := s.db.Beginx()
	if err != nil {
		slog.Error("failed to begin transaction", "error", err)
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	for _, shortcut := range getDefaultShortcuts() {
		_, err := tx.NamedExec(`
			INSERT INTO shortcuts (action, key_combo, description, category, dev_only)
			VALUES (:action, :key_combo, :description, :category, :dev_only)
		`, shortcut)
		if err != nil {
			_ = tx.Rollback()

			slog.Error("failed to insert default shortcut", "action", shortcut.Action, "error", err)
			return fmt.Errorf("failed to insert default shortcut '%s': %w", shortcut.Action, err)
		}
	}

	if err := tx.Commit(); err != nil {

		slog.Error("failed to commit default shortcuts", "error", err)
		return fmt.Errorf("failed to commit default shortcuts: %w", err)
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

		slog.Error("failed to fetch shortcuts", "error", err)
		return fmt.Errorf("failed to fetch shortcuts: %w", err)
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

	s.app.Event.On("route:changed", func(e *application.CustomEvent) {
		route, ok := e.Data.(string)
		if !ok {
			return
		}

		window, ok := s.app.Window.GetByName(e.Sender)
		if !ok || window == nil {
			return
		}

		cats, ok := routeCategoryMap[route]
		if !ok {
			for r, categories := range routeCategoryMap {
				if r != "/" && strings.HasPrefix(route, r) {
					cats = categories
					ok = true
					break
				}
			}
		}
		if !ok {
			// explicit fallback to root entry (e.g. {window})
			cats = routeCategoryMap["/"]
		}

		s.windowCategoriesMu.Lock()
		s.windowCategories[window.Name()] = cats
		s.windowCategoriesMu.Unlock()
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
	envInfo := s.app.Env.Info()

	s.mu.RLock()
	shortcuts := make([]Shortcut, 0, len(s.cache))
	// get all shortcuts from cache
	for _, sc := range s.cache {
		if sc.DevOnly && !envInfo.Debug {
			continue
		}
		shortcuts = append(shortcuts, sc)
	}
	s.mu.RUnlock()

	keyComboMap := make(map[string][]Shortcut)
	for _, shortcut := range shortcuts {
		keyComboMap[shortcut.KeyCombo] = append(keyComboMap[shortcut.KeyCombo], shortcut)
	}

	for keyCombo, shortcuts := range keyComboMap {
		shortcutsCopy := shortcuts
		s.app.KeyBinding.Add(keyCombo, func(window application.Window) {
			if !s.areShortcutsEnabled() {
				return
			}

			s.windowCategoriesMu.RLock()
			allowedCats, exists := s.windowCategories[window.Name()]
			s.windowCategoriesMu.RUnlock()

			if !exists {
				allowedCats = []string{"window"}
			}

			for _, shortcut := range shortcutsCopy {
				if !isCategoryAllowed(shortcut.Category, allowedCats) {
					continue
				}
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

func (s *ShortcutService) checkDuplicateInCache(newKeyCombo, excludeAction string, currentCategory string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	envInfo := s.app.Env.Info()

	for action, shortcut := range s.cache {
		// Skip dev-only shortcuts when not in debug mode - they aren't registered
		if shortcut.DevOnly && !envInfo.Debug {
			continue
		}
		if shortcut.KeyCombo != newKeyCombo || action == excludeAction {
			continue
		}
		if s.categoriesConflict(currentCategory, shortcut.Category) {
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
		slog.Error("key combo cannot be empty", "action", action)
		return err
	}

	s.mu.RLock()
	currentShortcut, exists := s.cache[action]
	s.mu.RUnlock()

	if !exists {
		err := fmt.Errorf("shortcut with action '%s' not found", action)
		slog.Error("shortcut not found", "action", action)
		return err
	}

	if err := s.checkDuplicateInCache(newKeyCombo, action, currentShortcut.Category); err != nil {
		slog.Error("duplicate shortcut key combo", "action", action, "keyCombo", newKeyCombo, "error", err)
		return err
	}

	s.mu.Lock()
	original := currentShortcut
	currentShortcut.KeyCombo = newKeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {

		// Rollback cache on DB failure
		s.mu.Lock()
		s.cache[action] = original
		s.mu.Unlock()

		slog.Error("failed to sync shortcut to database", "action", action, "error", err)
		return fmt.Errorf("failed to sync to database: %w", err)
	}

	if err := s.reloadShortcuts(); err != nil {
		slog.Error("failed to reload shortcuts", "action", action, "error", err)
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
		slog.Error("no default shortcut found", "action", action)
		return err
	}

	s.mu.RLock()
	currentShortcut, exists := s.cache[action]
	s.mu.RUnlock()

	if !exists {
		err := fmt.Errorf("shortcut with action '%s' not found", action)
		slog.Error("shortcut not found", "action", action)
		return err
	}

	s.mu.Lock()
	original := currentShortcut // save original
	currentShortcut.KeyCombo = defaultShortcut.KeyCombo
	currentShortcut.UpdatedAt = time.Now()
	s.cache[action] = currentShortcut
	s.mu.Unlock()

	if err := s.syncCacheToDatabase(currentShortcut); err != nil {
		s.mu.Lock()
		s.cache[action] = original // restore on failure
		s.mu.Unlock()

		slog.Error("failed to sync shortcut to database", "action", action, "error", err)
		return fmt.Errorf("failed to sync to database: %w", err)
	}

	if err := s.reloadShortcuts(); err != nil {
		slog.Error("failed to reload shortcuts", "action", action, "error", err)
		return err
	}

	return nil
}

func (s *ShortcutService) ResetAllShortcuts() error {
	defaults := getDefaultShortcuts()

	s.mu.Lock()
	originals := make(map[string]Shortcut, len(defaults))
	updated := make([]Shortcut, 0, len(defaults))
	for _, ds := range defaults {
		if cur, exists := s.cache[ds.Action]; exists {
			originals[ds.Action] = cur // save original
			cur.KeyCombo = ds.KeyCombo
			cur.UpdatedAt = time.Now()
			s.cache[ds.Action] = cur
			updated = append(updated, cur)
		}
	}
	s.mu.Unlock()

	// Single transaction instead of one DB call per shortcut
	tx, err := s.db.Beginx()
	if err != nil {
		// Restore all cache mutations
		s.mu.Lock()
		for action, orig := range originals {
			s.cache[action] = orig
		}
		s.mu.Unlock()
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	for _, shortcut := range updated {
		_, err := tx.Exec(`
            UPDATE shortcuts
            SET key_combo = ?, updated_at = CURRENT_TIMESTAMP
            WHERE action = ?
        `, shortcut.KeyCombo, shortcut.Action)
		if err != nil {
			_ = tx.Rollback()
			// Restore all cache mutations
			s.mu.Lock()
			for action, orig := range originals {
				s.cache[action] = orig
			}
			s.mu.Unlock()
			return fmt.Errorf("failed to reset shortcut '%s': %w", shortcut.Action, err)
		}
	}

	if err := tx.Commit(); err != nil {
		s.mu.Lock()
		for action, orig := range originals {
			s.cache[action] = orig
		}
		s.mu.Unlock()
		return fmt.Errorf("failed to commit reset: %w", err)
	}

	if err := s.reloadShortcuts(); err != nil {
		slog.Error("failed to reload shortcuts", "error", err)
		return err
	}

	return nil
}

func (s *ShortcutService) ServiceShutdown() error {
	slog.Info("Shortcut service shutting down")
	return nil
}
