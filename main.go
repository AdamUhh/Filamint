package main

import (
	internal "changeme/internal"
	services "changeme/internal/services"
	"changeme/internal/shortcuts"
	updater "changeme/internal/updater"

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

//go:embed build/config.yml
var buildConfig []byte

var currentVersion = parseVersion(buildConfig)

// get the second instance of 'version'
func parseVersion(data []byte) string {
	re := regexp.MustCompile(`(?m)^\s*version:\s*"?'?([0-9]+\.[0-9]+\.[0-9][^'"\n]*)'?"?`)
	matches := re.FindSubmatch(data)
	if len(matches) < 2 {
		return "dev"
	}
	return strings.TrimSpace(string(matches[1]))
}

func init() {
	// Register a custom event whose associated data type is string.
	// This is not required, but the binding generator will pick up registered events
	// and provide a strongly typed JS/TS API for them.
	application.RegisterEvent[string]("time")
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	// manifestURL := "https://github.com/AdamUhh/filamint/releases/latest/download/latest.json"
	manifestURL := "http://localhost:8765/latest.json"
	// testing manifest locally
	if localURL := os.Getenv("UPDATE_MANIFEST_URL"); localURL != "" {
		manifestURL = localURL
	}

	appDataDir, err := internal.GetAppDataDir()
	if err != nil {
		os.Exit(1)
	}

	logger, err := internal.NewLogger(appDataDir)
	if err != nil {
		os.Exit(1)
	}

	slog.Info("Running", "version", currentVersion)

	db, err := services.NewDatabase(filepath.Join(appDataDir, "db.db"))
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "Filamint",
		Description: "A 3D printing filament manager to keep track of spools, usage, and prints",
		Services: []application.Service{
			application.NewService(logger),
			application.NewService(db),
			application.NewService(updater.NewUpdater(currentVersion, manifestURL)),
			application.NewService(services.NewSpoolService(db)),
			application.NewService(services.NewPrintService(db)),
			application.NewService(shortcuts.NewShortcutService(db)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.filamint.13372026",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				wm := internal.GetWindowManager()
				if wm != nil {
					wm.RestoreAndFocus("main")
				}
			},
		},
	})

	wm := internal.NewWindowManager(app, appDataDir)

	wm.NewWindow("main", application.WebviewWindowOptions{
		Title: "Filamint",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		EnableFileDrop:   true,
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/#/",
		Width:            1200,
		Height:           700,
		InitialPosition:  application.WindowXY,
		X:                0,
		Y:                0,
	})

	// Run the application. This blocks until the application has been exited.
	err = app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
