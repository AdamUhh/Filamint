package main

import (
	internal "changeme/internal"
	services "changeme/internal/services"
	"io/fs"
	"net/http"
	"regexp"
	"strings"

	"embed"
	"log"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	// Register a custom event whose associated data type is string.
	// This is not required, but the binding generator will pick up registered events
	// and provide a strongly typed JS/TS API for them.
	application.RegisterEvent[string]("time")
}

func combinedHandler(assets fs.FS, modelsDir string) http.Handler {
	assetServer := application.AssetFileServerFS(assets)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/models/") {
			filename := filepath.Base(r.URL.Path)
			if matched, _ := regexp.MatchString(`^\d+\.(stl|3mf)$`, filename); !matched {
				http.NotFound(w, r)
				return
			}
			data, err := os.ReadFile(filepath.Join(modelsDir, filename))
			if err != nil {
				http.NotFound(w, r)
				return
			}
			if strings.HasSuffix(filename, ".stl") {
				w.Header().Set("Content-Type", "application/octet-stream")
			} else {
				w.Header().Set("Content-Type", "model/3mf")
			}
			w.Write(data)
			return
		}
		// Everything else → embedded frontend assets
		assetServer.ServeHTTP(w, r)
	})
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	appDataDir, err := internal.GetAppDataDir()
	if err != nil {
		slog.Error("Failed to resolve app data path", "error", err)
		os.Exit(1)
	}

	modelsDir, err := internal.GetModelsDir()
	if err != nil {
		slog.Error("Failed to resolve models path", "error", err)
		os.Exit(1)
	}

	logger, err := internal.NewLogger(appDataDir)
	if err != nil {
		slog.Error("Failed to initialize logger", "error", err)
		os.Exit(1)
	}

	db, err := services.NewDatabase(filepath.Join(appDataDir, "db.db"))
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	// modelsDir, err := internal.GetModelsDir()
	// if err != nil {
	// 	slog.Error("failed to resolve models dir", "error", err)
	// 	os.Exit(1)
	// }

	// fileServer := application.AssetFileServerFS(assets)
	// mux := http.NewServeMux()
	// mux.Handle("/", fileServer)
	// mux.Handle("/api/models/", ModelFileHandler(db, modelsDir))

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "filament-tracker",
		Description: "A 3D printing filament manager to keep track of spools, usage, and prints",
		Services: []application.Service{
			application.NewService(logger),
			application.NewService(db),
			application.NewService(services.NewSpoolService(db)),
			application.NewService(services.NewPrintService(db)),
			application.NewService(services.NewShortcutService(db)),
		},
		Assets: application.AssetOptions{
			// Handler:    application.AssetFileServerFS(assets),
			Handler: combinedHandler(assets, modelsDir),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create managed window (state persistence handled automatically)
	mw := internal.NewManagedWindow(app, filepath.Join(appDataDir, "window-state.json"))

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	mw.Create(application.WebviewWindowOptions{
		Title: "Filament Tracker",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		EnableFileDrop:   true,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
		Width:            1200,
		Height:           700,
		InitialPosition:  application.WindowXY,
		X:                0,
		Y:                0,
	})

	// Create a goroutine that emits an event containing the current time every second.
	// The frontend can listen to this event and update the UI accordingly.
	// go func() {
	// 	for {
	// 		now := time.Now().Format(time.RFC1123)
	// 		app.Event.Emit("time", now)
	// 		time.Sleep(time.Second)
	// 	}
	// }()

	// Run the application. This blocks until the application has been exited.
	err = app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
