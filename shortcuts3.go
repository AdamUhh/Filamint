package main

//
// import (
// 	"github.com/wailsapp/wails/v3/pkg/application"
// 	"runtime"
// )
//
// func getModifierKey() string {
// 	if runtime.GOOS == "darwin" {
// 		return "Cmd+"
// 	}
// 	return "Ctrl+"
// }
//
// func WindowShortcuts(app *application.App) {
// 	Ctrl := getModifierKey()
//
// 	// Only work in dev mode
// 	envInfo := app.Env.Info()
// 	if envInfo.Debug {
// 		app.KeyBinding.Add("F12", func(window application.Window) {
// 			window.OpenDevTools()
// 		})
//
// 		app.KeyBinding.Add(Ctrl+"R", func(window application.Window) {
// 			if window != nil {
// 				window.Reload()
// 			}
// 		})
// 	}
//
// 	app.KeyBinding.Add("F11", func(window application.Window) {
// 		window.ToggleFullscreen()
// 	})
//
// }
//
// func SpoolShortcuts(app *application.App) {
// 	Ctrl := getModifierKey()
//
// 	app.KeyBinding.Add(Ctrl+"T", func(window application.Window) {
// 		window.EmitEvent("spool:toggle_template", nil)
// 	})
//
// 	app.KeyBinding.Add(Ctrl+"N", func(window application.Window) {
// 		window.EmitEvent("spool:create", nil)
// 	})
//
// 	app.KeyBinding.Add(Ctrl+"Shift+S", func(window application.Window) {
// 		window.EmitEvent("spool:redirect", nil)
// 	})
//
// }
//
// func PrintShortcuts(app *application.App) {
// 	Ctrl := getModifierKey()
//
// 	app.KeyBinding.Add(Ctrl+"Shift+P", func(window application.Window) {
// 		window.EmitEvent("print:redirect", nil)
// 	})
//
// 	app.KeyBinding.Add(Ctrl+"N", func(window application.Window) {
// 		window.EmitEvent("print:create", nil)
// 	})
// }
//
// func KeyboardShortcuts(app *application.App) {
// 	WindowShortcuts(app)
// 	SpoolShortcuts(app)
// 	PrintShortcuts(app)
// }
