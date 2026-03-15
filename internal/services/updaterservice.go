package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Matches the JSON structure hosted on your update server / GitHub Releases
type Manifest struct {
	Version   string                      `json:"version"`
	Notes     string                      `json:"notes"`
	PubDate   string                      `json:"pub_date"`
	Platforms map[string]PlatformManifest `json:"platforms"`
}

type PlatformManifest struct {
	URL       string `json:"url"`
	Signature string `json:"signature,omitempty"`
}

type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	NewVersion     string `json:"newVersion"`
	Notes          string `json:"notes"`
	PubDate        string `json:"pubDate"`
	DownloadURL    string `json:"downloadUrl"`
}

type DownloadProgress struct {
	BytesDownloaded int64 `json:"bytesDownloaded"`
	TotalBytes      int64 `json:"totalBytes"`
	Percent         int   `json:"percent"`
}

type UpdateService struct {
	currentVersion string
	manifestURL    string
	httpClient     *http.Client
	app            *application.App
	OnProgress func(p DownloadProgress)
}

func NewUpdater(currentVersion, manifestURL string) *UpdateService {
	return &UpdateService{
		currentVersion: currentVersion,
		manifestURL:    manifestURL,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

func archKey() string {
	switch runtime.GOARCH {
	case "amd64":
		return "x86_64"
	case "arm64":
		return "aarch64"
	default:
		return runtime.GOARCH
	}
}

func platformKey() string {
	return runtime.GOOS + "-" + archKey()
}

// Fetches the manifest and returns update info
func (s *UpdateService) CheckForUpdate() (*UpdateInfo, error) {
	resp, err := s.httpClient.Get(s.manifestURL)
	if err != nil {
		slog.Error("failed to fetch update manifest", "error", err, "url", s.manifestURL)
		return nil, fmt.Errorf("fetching update manifest: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Error("update server returned unexpected status", "status", resp.StatusCode)
		return nil, fmt.Errorf("update server status: %d", resp.StatusCode)
	}

	var manifest Manifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		slog.Error("failed to parse update manifest", "error", err)
		return nil, fmt.Errorf("parsing update manifest: %w", err)
	}

	current, err := semver.NewVersion(s.currentVersion)
	if err != nil {
		slog.Error("invalid current version", "version", s.currentVersion, "error", err)
		return nil, fmt.Errorf("invalid current version %q: %w", s.currentVersion, err)
	}
	latest, err := semver.NewVersion(manifest.Version)
	if err != nil {
		slog.Error("invalid manifest version", "version", manifest.Version, "error", err)
		return nil, fmt.Errorf("invalid manifest version %q: %w", manifest.Version, err)
	}

	info := &UpdateInfo{
		CurrentVersion: s.currentVersion,
		NewVersion:     manifest.Version,
		Notes:          manifest.Notes,
		PubDate:        manifest.PubDate,
		Available:      latest.GreaterThan(current),
	}

	if info.Available {
		slog.Info("update available",
			"current", s.currentVersion,
			"latest", manifest.Version,
		)
		url, err := resolvePlatformURL(manifest.Platforms)
		if err != nil {
			return nil, err
		}
		info.DownloadURL = url
	}

	return info, nil
}

// isPortableWindows returns true when the running executable is not located
// inside Program Files — the conventional signal that it is a portable build.
func isPortableWindows() bool {
	self, err := os.Executable()
	if err != nil {
		return false
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return false
	}
	for _, env := range []string{"PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432"} {
		pf := os.Getenv(env)
		if pf != "" && len(self) >= len(pf) && strings.EqualFold(self[:len(pf)], pf) {
			return false
		}
	}
	return true
}

// Picks the best URL for the current platform
func resolvePlatformURL(platforms map[string]PlatformManifest) (string, error) {
	if runtime.GOOS == "linux" {
		arch := archKey()
		// Prefer raw binary, then .deb, then AppImage
		if p, ok := platforms["linux-"+arch+"-binary"]; ok && p.URL != "" {
			return p.URL, nil
		}
		if p, ok := platforms["linux-"+arch+"-deb"]; ok && p.URL != "" {
			return p.URL, nil
		}
		if p, ok := platforms["linux-"+arch]; ok && p.URL != "" {
			return p.URL, nil
		}
		slog.Error("no linux update url found", "arch", arch)
		return "", fmt.Errorf("no Linux update URL found for arch %q", arch)
	}

	if runtime.GOOS == "windows" && isPortableWindows() {
		key := platformKey() + "-portable"
		if p, ok := platforms[key]; ok && p.URL != "" {
			slog.Info("portable mode detected, using portable update URL", "key", key)
			return p.URL, nil
		}
		// No portable artifact available — refuse rather than silently install
		slog.Error("no portable update available for platform", "platform", key)
		return "", fmt.Errorf("no portable update available for platform %q; download manually from the releases page", key)
	}

	key := platformKey()
	p, ok := platforms[key]
	if !ok || p.URL == "" {
		slog.Error("no update available for platform", "platform", key)
		return "", fmt.Errorf("no update available for platform %q", key)
	}
	return p.URL, nil
}

// Downloads the update and replaces the binary
// On Windows: downloads .exe installer and runs it (NSIS/Inno Setup style)
// On macOS: downloads .dmg and opens it
// On Linux: downloads binary, else AppImage, makes it executable, replaces current binary
func (s *UpdateService) DownloadAndInstall(downloadURL string) error {
	ext := filepath.Ext(downloadURL)
	// Linux raw binary has no extension — label it explicitly
	if runtime.GOOS == "linux" && ext == "" {
		ext = ".bin"
	}

	tmpFile, err := os.CreateTemp("", "app-update-*"+ext)
	if err != nil {
		slog.Error("failed to create temp update file", "error", err)
		return fmt.Errorf("creating temp update file: %w", err)
	}
	defer tmpFile.Close()
	tmpPath := tmpFile.Name()

	// Clean up the temp file on any error return.
	// Not deferred unconditionally: on Windows and Linux the process calls
	// os.Exit(0) as part of a successful install, so this closure never runs
	// in the happy path there. On macOS, installDarwin returns normally and
	// the DMG is still needed by the Finder mount — so we leave it alone on
	// success and only remove it if we're returning an error.
	var installErr error
	defer func() {
		if installErr != nil {
			os.Remove(tmpPath)
		}
	}()

	slog.Info("starting update download",
		"url", downloadURL,
		"os", runtime.GOOS,
		"arch", runtime.GOARCH,
		"temp_path", tmpPath,
	)

	if err := s.downloadWithProgress(downloadURL, tmpFile); err != nil {
		slog.Error("update download failed", "error", err, "url", downloadURL)
		installErr = fmt.Errorf("downloading update: %w", err)
		return installErr
	}

	switch runtime.GOOS {
	case "windows":
		if isPortableWindows() {
			installErr = s.installWindowsPortable(tmpPath)
		} else {
			installErr = s.installWindows(tmpPath)
		}
	case "darwin":
		installErr = s.installDarwin(tmpPath)
	case "linux":
		// Route by what we actually downloaded
		switch ext {
		case ".AppImage":
			installErr = s.installLinuxAppImage(tmpPath)
		case ".deb":
			installErr = s.installLinuxDeb(tmpPath)
		default:
			installErr = s.installLinuxBinary(tmpPath) // raw binary (.bin temp file)
		}
	default:
		installErr = fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	return installErr
}

func (s *UpdateService) downloadWithProgress(url string, dest io.Writer) error {
	resp, err := s.httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	total := resp.ContentLength
	var downloaded int64

	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			written, werr := dest.Write(buf[:n])
			downloaded += int64(written)
			if s.OnProgress != nil {
				pct := 0
				if total > 0 {
					pct = int(downloaded * 100 / total)
				}
				s.OnProgress(DownloadProgress{
					BytesDownloaded: downloaded,
					TotalBytes:      total,
					Percent:         pct,
				})
			}
			if werr != nil {
				return werr
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *UpdateService) installWindows(path string) error {
	// Run the installer silently; it will replace the app and optionally relaunch
	cmd := exec.Command(path, "/S") // NSIS silent flag; use /SILENT for Inno Setup
	cmd.Start()
	// Give installer a moment to start, then quit our process
	time.Sleep(500 * time.Millisecond)
	os.Exit(0)
	return nil
}

// installWindowsPortable replaces the running portable .exe in-place using a
// small helper batch script, then relaunches the updated binary.
func (s *UpdateService) installWindowsPortable(tmpPath string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return err
	}

	// Batch script: wait for our process to exit, copy the new binary over, relaunch
	script := fmt.Sprintf(`@echo off
	timeout /t 1 /nobreak >nul
	copy /y "%s" "%s"
	start "" "%s"
`, tmpPath, self, self)

	scriptFile, err := os.CreateTemp("", "filamint-update-*.bat")
	if err != nil {
		return err
	}
	scriptFile.WriteString(script)
	scriptFile.Close()

	exec.Command("cmd", "/C", scriptFile.Name()).Start()
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

func (s *UpdateService) installDarwin(path string) error {
	// Open the .dmg — user drags to Applications (standard macOS UX)
	if err := exec.Command("open", path).Run(); err != nil {
		slog.Error("failed to open dmg installer", "error", err, "path", path)
		return fmt.Errorf("opening dmg installer: %w", err)
	}
	return nil
}

// installLinuxDeb installs a .deb package via dpkg, then relaunches the app.
func (s *UpdateService) installLinuxDeb(tmpPath string) error {
	cmd := exec.Command("dpkg", "-i", tmpPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		slog.Error("dpkg install failed", "error", err, "path", tmpPath)
		return fmt.Errorf("dpkg install failed: %w", err)
	}

	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return err
	}

	exec.Command(self).Start()
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

// installLinuxBinary replaces the running binary in-place.
func (s *UpdateService) installLinuxBinary(tmpPath string) error {
	if err := os.Chmod(tmpPath, 0755); err != nil {
		return err
	}
	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return err
	}

	script := fmt.Sprintf(`#!/bin/sh
sleep 1
cp "%s" "%s"
chmod +x "%s"
"%s" &
`, tmpPath, self, self, self)

	scriptFile, err := os.CreateTemp("", "filamint-update-*.sh")
	if err != nil {
		return err
	}
	scriptFile.WriteString(script)
	scriptFile.Close()
	os.Chmod(scriptFile.Name(), 0755)

	exec.Command("/bin/sh", scriptFile.Name()).Start()
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

// installLinuxAppImage makes the AppImage executable and replaces the current binary.
func (s *UpdateService) installLinuxAppImage(tmpPath string) error {
	if err := os.Chmod(tmpPath, 0755); err != nil {
		return err
	}
	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return err
	}

	script := fmt.Sprintf(`#!/bin/sh
sleep 1
cp "%s" "%s"
chmod +x "%s"
"%s" &
`, tmpPath, self, self, self)

	scriptFile, err := os.CreateTemp("", "filamint-update-*.sh")
	if err != nil {
		return err
	}
	scriptFile.WriteString(script)
	scriptFile.Close()
	os.Chmod(scriptFile.Name(), 0755)

	exec.Command("/bin/sh", scriptFile.Name()).Start()
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

func (s *UpdateService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	slog.Info("Updater service started")

	s.app = application.Get()

	// Wire download progress to frontend events
	s.OnProgress = func(p DownloadProgress) {
		s.app.Event.Emit("updater:progress", p)
	}

	// Check for updates on startup in the background
	go func() {
		info, err := s.CheckForUpdate()
		if err != nil {
			slog.Error("Error checking for update", "error", err)
			return
		}
		if !info.Available {
			slog.Info("No update found")
			return
		}
		s.app.Event.Emit("updater:available", info)
	}()

	return nil
}

func (s *UpdateService) ServiceShutdown() error {

	slog.Info("Updater service shutting down")
	return nil
}
