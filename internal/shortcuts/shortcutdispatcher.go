package shortcuts

import (
	"fmt"
	"log/slog"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func dispatchAction(window application.Window, action string) {
	windowID := fmt.Sprintf("window-%d", window.ID())
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
