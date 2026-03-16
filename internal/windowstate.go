package internal

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var instance *WindowManager

type WindowState struct {
	X          int  `json:"x"`
	Y          int  `json:"y"`
	Width      int  `json:"width"`
	Height     int  `json:"height"`
	Maximised  bool `json:"maximised"`
	Fullscreen bool `json:"fullscreen"`
}

type ManagedWindow struct {
	window   *application.WebviewWindow
	state    WindowState
	dirty    bool
	filePath string
}

type WindowManager struct {
	app      *application.App
	stateDir string
	mu       sync.Mutex
	windows  map[string]*ManagedWindow
	counter  atomic.Int64
}

func NewWindowManager(app *application.App, stateDir string) *WindowManager {
	instance = &WindowManager{
		app:      app,
		stateDir: stateDir,
		windows:  make(map[string]*ManagedWindow),
	}
	return instance
}

func GetWindowManager() *WindowManager {
	return instance
}

// Creates a persistent, state-tracked window under the given key
func (wm *WindowManager) NewWindow(key string, options application.WebviewWindowOptions) *application.WebviewWindow {
	mw := &ManagedWindow{
		filePath: filepath.Join(wm.stateDir, fmt.Sprintf("window-%s.json", key)),
	}
	mw.window = wm.app.Window.NewWithOptions(options)
	mw.loadState()
	mw.setupHandlers(wm, key)

	wm.mu.Lock()
	wm.windows[key] = mw
	wm.mu.Unlock()

	return mw.window
}

// Creates a window with no state persistence (e.g. temp windows)
func (wm *WindowManager) NewTransientWindow(options application.WebviewWindowOptions) *application.WebviewWindow {
	id := fmt.Sprintf("transient-%d", wm.counter.Add(1))

	mw := &ManagedWindow{
		window: wm.app.Window.NewWithOptions(options),
	}

	mw.window.OnWindowEvent(events.Common.WindowClosing, func(e *application.WindowEvent) {
		wm.mu.Lock()
		delete(wm.windows, id)
		wm.mu.Unlock()
	})

	wm.mu.Lock()
	wm.windows[id] = mw
	wm.mu.Unlock()

	return mw.window
}

func (mw *ManagedWindow) setupHandlers(wm *WindowManager, key string) {
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
		w, h := mw.window.Size()
		mw.state.Width = w
		mw.state.Height = h
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
			mw.saveState()
		}
		wm.mu.Lock()
		delete(wm.windows, key)
		wm.mu.Unlock()
	})
}

func (mw *ManagedWindow) loadState() {
	data, err := os.ReadFile(mw.filePath)
	if err != nil {
		slog.Warn("No window state found, centering window", "file", mw.filePath)
		mw.window.Center()
		return
	}
	if err := json.Unmarshal(data, &mw.state); err != nil {
		slog.Error("Failed to parse window state", "error", err)
		mw.window.Center()
		return
	}
	mw.window.SetRelativePosition(mw.state.X, mw.state.Y)
	mw.window.SetSize(mw.state.Width, mw.state.Height)
	if mw.state.Maximised {
		mw.window.Maximise()
	}
	if mw.state.Fullscreen {
		mw.window.Fullscreen()
	}
}

func (mw *ManagedWindow) saveState() {
	data, err := json.MarshalIndent(mw.state, "", "  ")
	if err != nil {
		slog.Error("Failed to marshal window state", "error", err)
		return
	}
	if err := os.WriteFile(mw.filePath, data, 0644); err != nil {
		slog.Error("Failed to write window state", "error", err)
		return
	}
	mw.dirty = false
}

func (wm *WindowManager) RestoreAndFocus(key string) {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if key != "" {
		if mw, ok := wm.windows[key]; ok && mw.window != nil {
			mw.window.Restore()
			mw.window.Focus()
			return
		}
	}

	// Fallback: restore the first window in the map
	for _, mw := range wm.windows {
		if mw.window != nil {
			mw.window.Restore()
			mw.window.Focus()
			break
		}
	}
}
