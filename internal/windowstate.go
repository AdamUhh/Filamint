package internal

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type WindowState struct {
	X          int  `json:"x"`
	Y          int  `json:"y"`
	Width      int  `json:"width"`
	Height     int  `json:"height"`
	Maximised  bool `json:"maximised"`
	Fullscreen bool `json:"fullscreen"`
}

type ManagedWindow struct {
	app    *application.App
	window *application.WebviewWindow
	state  WindowState
	dirty  bool
	file   string
}

func NewManagedWindow(app *application.App, stateFile string) *ManagedWindow {
	return &ManagedWindow{
		app:  app,
		file: stateFile,
	}
}

func (mw *ManagedWindow) Create(options application.WebviewWindowOptions) {
	mw.window = mw.app.Window.NewWithOptions(options)
	mw.LoadState()
	mw.setupHandlers()
}

func (mw *ManagedWindow) setupHandlers() {
	mw.window.OnWindowEvent(events.Common.WindowDidMove, func(e *application.WindowEvent) {
		if mw.state.Maximised || mw.state.Fullscreen {
			return
		}
		x, y := mw.window.Position()
		mw.state.X = x
		mw.state.Y = y
		mw.dirty = true
	})

	mw.window.OnWindowEvent(events.Common.WindowDidResize, func(e *application.WindowEvent) {
		if mw.state.Maximised || mw.state.Fullscreen {
			return
		}
		width, height := mw.window.Size()
		mw.state.Width = width
		mw.state.Height = height
		mw.dirty = true
	})

	mw.window.OnWindowEvent(events.Common.WindowMaximise, func(e *application.WindowEvent) {
		mw.state.Maximised = true
		mw.dirty = true
	})

	mw.window.OnWindowEvent(events.Common.WindowRestore, func(e *application.WindowEvent) {
		mw.state.Maximised = false
		mw.dirty = true
	})

	mw.window.OnWindowEvent(events.Common.WindowFullscreen, func(e *application.WindowEvent) {
		mw.state.Fullscreen = true
		mw.dirty = true
	})

	mw.window.OnWindowEvent(events.Common.WindowUnFullscreen, func(e *application.WindowEvent) {
		mw.state.Fullscreen = false
		mw.dirty = true
	})

	mw.window.OnWindowEvent(events.Common.WindowClosing, func(e *application.WindowEvent) {
		if mw.dirty {
			mw.SaveState()
		}
	})
}

func (mw *ManagedWindow) LoadState() {
	data, err := os.ReadFile(mw.file)
	if err != nil {
		err = fmt.Errorf("Failed to read window state file: %w", err)
		slog.Error(err.Error())

		mw.window.Center()
		return
	}

	if err := json.Unmarshal(data, &mw.state); err != nil {
		err = fmt.Errorf("failed to unmarshal window state: %w", err)
		slog.Error(err.Error())

		mw.window.Center()
		return
	}

	// fmt.Println("Loading window state:", mw.state)
	mw.window.SetRelativePosition(mw.state.X, mw.state.Y)
	mw.window.SetSize(mw.state.Width, mw.state.Height)

	if mw.state.Maximised {
		mw.window.Maximise()
	}

	if mw.state.Fullscreen {
		mw.window.Fullscreen()
	}
}

func (mw *ManagedWindow) SaveState() {
	// fmt.Println("Saving window state:", mw.state)

	data, err := json.MarshalIndent(mw.state, "", "  ")
	if err != nil {
		err = fmt.Errorf("failed to save window state: %w", err)
		slog.Error(err.Error())
		return
	}

	_ = os.WriteFile(mw.file, data, 0644)
	mw.dirty = false
}
