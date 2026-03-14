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
	"time"

	"github.com/Masterminds/semver/v3"
)

// Manifest matches the JSON structure hosted on your update server / GitHub Releases
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

// UpdateInfo is what gets sent to the frontend
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	NewVersion     string `json:"newVersion"`
	Notes          string `json:"notes"`
	PubDate        string `json:"pubDate"`
	DownloadURL    string `json:"downloadUrl"`
}

// DownloadProgress is emitted during download
type DownloadProgress struct {
	BytesDownloaded int64 `json:"bytesDownloaded"`
	TotalBytes      int64 `json:"totalBytes"`
	Percent         int   `json:"percent"`
}

type UpdateService struct {
	currentVersion string
	manifestURL    string
	httpClient     *http.Client
	// OnProgress is called during download; wire this to app.Event.Emit
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

// CheckForUpdate fetches the manifest and returns update info.
// Called from the frontend via Wails bindings.
func (s *UpdateService) CheckForUpdate() (*UpdateInfo, error) {
	resp, err := s.httpClient.Get(s.manifestURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch update manifest: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("update server returned status %d", resp.StatusCode)
	}

	var manifest Manifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, fmt.Errorf("failed to parse update manifest: %w", err)
	}

	current, err := semver.NewVersion(s.currentVersion)
	if err != nil {
		return nil, fmt.Errorf("invalid current version %q: %w", s.currentVersion, err)
	}
	latest, err := semver.NewVersion(manifest.Version)
	if err != nil {
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
		url, err := resolvePlatformURL(manifest.Platforms)
		if err != nil {
			return nil, err
		}
		info.DownloadURL = url
	}

	return info, nil
}

// resolvePlatformURL picks the best URL for the current platform.
// On Linux: prefers the raw binary, falls back to AppImage.
func resolvePlatformURL(platforms map[string]PlatformManifest) (string, error) {
	if runtime.GOOS == "linux" {
		arch := archKey()
		// Prefer raw binary
		if p, ok := platforms["linux-"+arch+"-binary"]; ok && p.URL != "" {
			return p.URL, nil
		}
		// Fall back to AppImage
		if p, ok := platforms["linux-"+arch]; ok && p.URL != "" {
			return p.URL, nil
		}
		return "", fmt.Errorf("no Linux update URL found for arch %q", arch)
	}

	key := platformKey()
	p, ok := platforms[key]
	if !ok || p.URL == "" {
		return "", fmt.Errorf("no update available for platform %q", key)
	}
	return p.URL, nil
}

// DownloadAndInstall downloads the update and launches the installer / replaces the binary.
// On Windows: downloads .exe installer and runs it (NSIS/Inno Setup style).
// On macOS: downloads .dmg and opens it.
// On Linux: downloads binary, else AppImage, makes it executable, replaces current binary.
func (s *UpdateService) DownloadAndInstall(downloadURL string) error {
	ext := filepath.Ext(downloadURL)
	// Linux raw binary has no extension — label it explicitly
	if runtime.GOOS == "linux" && ext == "" {
		ext = ".bin"
	}

	tmpFile, err := os.CreateTemp("", "app-update-*"+ext)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer tmpFile.Close()
	tmpPath := tmpFile.Name()

	if err := s.downloadWithProgress(downloadURL, tmpFile); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("download failed: %w", err)
	}

	switch runtime.GOOS {
	case "windows":
		return s.installWindows(tmpPath)
	case "darwin":
		return s.installDarwin(tmpPath)
	case "linux":
		// Route by what we actually downloaded
		if ext == ".AppImage" {
			return s.installLinuxAppImage(tmpPath)
		}
		return s.installLinuxBinary(tmpPath) // raw binary (.bin temp file)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
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

func (s *UpdateService) installDarwin(path string) error {
	// Open the .dmg — user drags to Applications (standard macOS UX)
	if err := exec.Command("open", path).Run(); err != nil {
		return fmt.Errorf("failed to open dmg: %w", err)
	}
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

func platformKey() string {
	return runtime.GOOS + "-" + archKey()
}

func (s *UpdateService) ServiceStartup(ctx context.Context, options any) error {
	slog.Info("Updater service shutting down")
	return nil
}

func (s *UpdateService) ServiceShutdown() error {

	slog.Info("Updater service shutting down")
	return nil
}
