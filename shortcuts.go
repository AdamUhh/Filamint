package main

import (
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
)

var shortcutRegistrar *ShortcutRegistrar

type ShortcutRegistrar struct {
	app *application.App
}

func RegisterShortcuts(app *application.App, db *Database) error {
	// Create and store the registrar for auto-reload
	shortcutRegistrar = &ShortcutRegistrar{app: app}

	service := NewShortcutService(db)
	return registerShortcutsInternal(app, service)
}

// Removes old shortcuts and re-registers with updated shortcuts
// This is called automatically by ShortcutService after any update
func (sr *ShortcutRegistrar) reloadShortcuts(service *ShortcutService) error {
	existingBindings := sr.app.KeyBinding.GetAll()

	for _, binding := range existingBindings {
		sr.app.KeyBinding.Remove(binding.Accelerator)
	}

	return registerShortcutsInternal(sr.app, service)
}

func registerShortcutsInternal(app *application.App, service *ShortcutService) error {
	shortcuts, err := service.GetAllShortcuts()
	if err != nil {
		return fmt.Errorf("failed to load shortcuts: %w", err)
	}

	envInfo := app.Env.Info()

	// Group shortcuts by key combo to handle duplicates
	keyComboMap := make(map[string][]Shortcut)
	for _, shortcut := range shortcuts {
		// Skip dev-only shortcuts in production
		if !envInfo.Debug && (shortcut.Action == "window:devtools" || shortcut.Action == "window:reload") {
			continue
		}
		keyComboMap[shortcut.KeyCombo] = append(keyComboMap[shortcut.KeyCombo], shortcut)
	}

	// Register each unique key combo once with all its actions
	for keyCombo, shortcuts := range keyComboMap {
		shortcutsCopy := shortcuts

		app.KeyBinding.Add(keyCombo, func(window application.Window) {
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
