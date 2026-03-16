package shortcuts

import (
	services "changeme/internal/services"
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync/atomic"
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
	store   *ShortcutStore
	router  *ShortcutRouter
	app     *application.App
	enabled atomic.Bool
}

func NewShortcutService(database *services.Database) *ShortcutService {
	s := &ShortcutService{
		store:  NewShortcutStore(database.DB()),
		router: NewShortcutRouter(DefaultRouteMap),
	}
	s.enabled.Store(true)
	return s
}

// Public
func (s *ShortcutService) GetAllShortcuts() ([]Shortcut, error) {
	return s.store.All(s.app.Env.Info().Debug), nil
}

func (s *ShortcutService) GetShortcutCombo(action string) (string, error) {
	return s.store.Combo(action), nil
}

func (s *ShortcutService) GetShortcutCombos(actions []string) []string {
	return s.store.Combos(actions)
}

func (s *ShortcutService) UpdateShortcut(action, newKeyCombo string) error {
	newKeyCombo = strings.TrimSpace(newKeyCombo)
	if newKeyCombo == "" {
		return fmt.Errorf("key combo cannot be empty")
	}
	cur, ok := s.store.cache[action] // quick read - store exposes this via a method below
	if !ok {
		return fmt.Errorf("action %q not found", action)
	}
	devMode := s.app.Env.Info().Debug
	if err := s.store.CheckDuplicate(newKeyCombo, action, cur.Category, devMode); err != nil {
		return err
	}
	if err := s.store.Update(action, newKeyCombo); err != nil {
		return err
	}
	return s.reloadBindings()
}

func (s *ShortcutService) ResetShortcut(action string) error {
	if err := s.store.ResetOne(action); err != nil {
		return err
	}
	return s.reloadBindings()
}

func (s *ShortcutService) ResetAllShortcuts() error {
	if err := s.store.ResetAll(); err != nil {
		return err
	}
	return s.reloadBindings()
}

// Wails lifecycle
func (s *ShortcutService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	slog.Info("shortcut service starting")
	s.app = application.Get()

	if err := s.store.Init(); err != nil {
		return err
	}

	s.app.Event.On("shortcuts:set_enabled", func(e *application.CustomEvent) {
		if enabled, ok := e.Data.(bool); ok {
			s.enabled.Store(enabled)
		}
	})

	s.app.Event.On("route:changed", func(e *application.CustomEvent) {
		route, ok := e.Data.(string)
		if !ok {
			return
		}
		win, ok := s.app.Window.GetByName(e.Sender)
		if !ok || win == nil {
			return
		}
		s.router.SetWindowRoute(win.Name(), route)
	})

	return s.registerBindings()
}

func (s *ShortcutService) ServiceShutdown() error {
	slog.Info("shortcut service shutting down")
	return nil
}

// Internal helpers

func (s *ShortcutService) reloadBindings() error {
	for _, b := range s.app.KeyBinding.GetAll() {
		s.app.KeyBinding.Remove(b.Accelerator)
	}
	if err := s.registerBindings(); err != nil {
		return err
	}
	for _, win := range s.app.Window.GetAll() {
		win.EmitEvent("window:reload_shortcuts", nil)
	}
	return nil
}

func (s *ShortcutService) registerBindings() error {
	devMode := s.app.Env.Info().Debug
	shortcuts := s.store.All(devMode)

	// Group by key combo so one key fires multiple actions when appropriate.
	byCombo := make(map[string][]Shortcut)
	for _, sc := range shortcuts {
		byCombo[sc.KeyCombo] = append(byCombo[sc.KeyCombo], sc)
	}

	for combo, group := range byCombo {
		s.app.KeyBinding.Add(combo, func(win application.Window) {
			if !s.enabled.Load() {
				return
			}
			allowed := s.router.AllowedCategories(win.Name())
			for _, sc := range group {
				if slices.Contains(allowed, sc.Category) {
					dispatchAction(win, sc.Action)
				}
			}
		})
	}
	return nil
}
