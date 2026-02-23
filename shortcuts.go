package main

import (
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
	"sync"
)

var shortcutRegistrar *ShortcutRegistrar

type ShortcutRegistrar struct {
	app              *application.App
	shortcutsEnabled bool
	mu               sync.RWMutex
}

func RegisterShortcuts(app *application.App, db *Database) error {
	service := NewShortcutService(db)
	shortcutRegistrar = &ShortcutRegistrar{
		app:              app,
		shortcutsEnabled: true,
	}

	app.Event.On("shortcuts:set_enabled", func(e *application.CustomEvent) {
		if enabled, ok := e.Data.(bool); ok {
			shortcutRegistrar.mu.Lock()
			shortcutRegistrar.shortcutsEnabled = enabled
			shortcutRegistrar.mu.Unlock()
		}
	})

	return registerShortcutsInternal(app, service)
}

func (sr *ShortcutRegistrar) areShortcutsEnabled() bool {
	sr.mu.RLock()
	defer sr.mu.RUnlock()
	return sr.shortcutsEnabled
}

func (sr *ShortcutRegistrar) reloadShortcuts(service *ShortcutService) error {
	existingBindings := sr.app.KeyBinding.GetAll()
	for _, binding := range existingBindings {
		sr.app.KeyBinding.Remove(binding.Accelerator)
	}
	if err := registerShortcutsInternal(sr.app, service); err != nil {
		return err
	}
	for _, window := range sr.app.Window.GetAll() {
		window.EmitEvent("window:reload_shortcuts", nil)
	}
	return nil
}

func registerShortcutsInternal(app *application.App, service *ShortcutService) error {
	shortcuts, err := service.GetAllShortcuts()
	if err != nil {
		return fmt.Errorf("failed to load shortcuts: %w", err)
	}
	envInfo := app.Env.Info()
	keyComboMap := make(map[string][]Shortcut)
	for _, shortcut := range shortcuts {
		if shortcut.DevOnly && !envInfo.Debug {
			continue
		}
		keyComboMap[shortcut.KeyCombo] = append(keyComboMap[shortcut.KeyCombo], shortcut)
	}
	for keyCombo, shortcuts := range keyComboMap {
		shortcutsCopy := shortcuts
		app.KeyBinding.Add(keyCombo, func(window application.Window) {
			// Check if shortcuts are enabled
			if !shortcutRegistrar.areShortcutsEnabled() {
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
		if window != nil {
			window.Reload()
		}
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
