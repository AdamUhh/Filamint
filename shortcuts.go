package main

import (
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func RegisterShortcuts(app *application.App, db *Database) error {
	service := NewShortcutService(db)

	shortcuts, err := service.GetAllShortcuts()
	if err != nil {
		return fmt.Errorf("failed to load shortcuts: %w", err)
	}

	envInfo := app.Env.Info()

	for _, shortcut := range shortcuts {
		action := shortcut.Action
		keyCombo := shortcut.KeyCombo

		// Skip dev-only shortcuts in production
		if !envInfo.Debug && (action == "window:devtools" || action == "window:reload") {
			continue
		}

		switch action {
		case "window:fullscreen":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.ToggleFullscreen()
			})

		case "window:devtools":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.OpenDevTools()
			})

		case "window:reload":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				if window != nil {
					window.Reload()
				}
			})

		case "spool:toggle_template":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.EmitEvent("spool:toggle_template", nil)
			})

		case "spool:create":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.EmitEvent("spool:create", nil)
			})

		case "spool:redirect":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.EmitEvent("spool:redirect", nil)
			})

		case "print:redirect":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.EmitEvent("print:redirect", nil)
			})

		case "print:create":
			app.KeyBinding.Add(keyCombo, func(window application.Window) {
				window.EmitEvent("print:create", nil)
			})
		}
	}

	return nil
}
