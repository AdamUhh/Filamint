package updater

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
	"sync"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/wailsapp/wails/v3/pkg/application"
)

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
	OnProgress     func(p DownloadProgress)

	checkMu   sync.Mutex
	cond      *sync.Cond
	checking  bool
	cached    *UpdateInfo
	cachedErr error
	cacheAt   time.Time
	cacheTTL  time.Duration
}

func NewUpdater(currentVersion, manifestURL string) *UpdateService {
	s := &UpdateService{
		currentVersion: currentVersion,
		manifestURL:    manifestURL,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
		cacheTTL:       10 * time.Minute,
	}
	s.cond = sync.NewCond(&s.checkMu)
	return s
}

// Normalise GOARCH into the keys used in latest.json.
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

func isPortableWindows() bool {
	return buildType == "portable"
}

func isDebLinux() bool {
	return linuxPackage == "deb"
}

// Returns the exact key that should be present in latest.json
// for the current OS / arch / install-mode combination
//
// Keys must match what your GHA release.yml writes:
//
//	windows-x86_64-installer
//	windows-x86_64-portable
//	darwin-aarch64
//	darwin-x86_64
//	linux-x86_64        (raw binary)
//	linux-x86_64-deb
func manifestKey() (string, error) {
	arch := archKey()
	switch runtime.GOOS {
	case "windows":
		if isPortableWindows() {
			return "windows-" + arch + "-portable", nil
		}
		return "windows-" + arch + "-installer", nil

	case "darwin":
		return "darwin-" + arch, nil

	case "linux":
		if isDebLinux() {
			return "linux-" + arch + "-deb", nil
		}
		return "linux-" + arch, nil

	default:

		slog.Error("unsupported platform", "os", runtime.GOOS, "arch", arch)
		return "", fmt.Errorf("unsupported platform: %s/%s", runtime.GOOS, arch)
	}
}

// resolvePlatformURL picks the download URL from the manifest for the current
// platform, applying any platform-specific fallback logic.
func resolvePlatformURL(platforms map[string]PlatformManifest) (string, error) {
	key, err := manifestKey()
	if err != nil {
		return "", err
	}
	p, ok := platforms[key]
	if !ok || p.URL == "" {
		slog.Error("no update url found for", "key", key)
		return "", fmt.Errorf("no update URL found for key %q", key)
	}
	slog.Info("resolved update url", "key", key, "url", p.URL)
	return p.URL, nil
}

// Performs a GET with up to maxAttempts tries, returns the first successful *http.Response
// each retry is performed after an exponential amount of time
func (s *UpdateService) fetchWithRetry(url string, maxAttempts int) (*http.Response, error) {
	var lastErr error
	backoff := 1 * time.Second

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		resp, err := s.httpClient.Get(url)
		if err == nil && resp.StatusCode == http.StatusOK {
			return resp, nil
		}
		if err == nil {
			resp.Body.Close()
			lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
		} else {
			lastErr = err
		}

		slog.Warn("update request failed, will retry",
			"attempt", attempt,
			"max", maxAttempts,
			"backoff", backoff,
			"error", lastErr,
		)
		if attempt < maxAttempts {
			time.Sleep(backoff)
			backoff *= 2
		}
	}
	return nil, fmt.Errorf("all %d attempts failed: %w", maxAttempts, lastErr)
}

func (s *UpdateService) CheckForUpdate() (*UpdateInfo, error) {
	s.checkMu.Lock()
	// Wait if another goroutine is already checking
	// Re-evaluate the cache afterward as the checker may have populated it
	for s.checking {
		s.cond.Wait()
	}
	if !s.cacheAt.IsZero() && time.Since(s.cacheAt) < s.cacheTTL {
		info, err := s.cached, s.cachedErr
		s.checkMu.Unlock()
		return info, err
	}
	s.checking = true
	s.checkMu.Unlock()
	// Guarantee waiters are unblocked and state is cleaned up even on panic.
	defer func() {
		s.checkMu.Lock()
		s.checking = false
		s.cond.Broadcast()
		s.checkMu.Unlock()
	}()
	info, err := s.doCheckForUpdate()
	s.checkMu.Lock()
	s.cached, s.cachedErr, s.cacheAt = info, err, time.Now()
	s.checkMu.Unlock()
	return info, err
}

// Fetches the manifest and returns update info
func (s *UpdateService) doCheckForUpdate() (*UpdateInfo, error) {
	resp, err := s.fetchWithRetry(s.manifestURL, 3)
	if err != nil {
		slog.Error("failed to fetch update manifest", "error", err, "url", s.manifestURL)
		return nil, fmt.Errorf("fetching update manifest: %w", err)
	}
	defer resp.Body.Close()

	var manifest Manifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		slog.Error("failed to parse update manifest", "error", err)
		return nil, fmt.Errorf("parsing update manifest: %w", err)
	}

	current, err := semver.NewVersion(s.currentVersion)
	if err != nil {
		slog.Error("current version is invalid", "version", s.currentVersion, "error", err)
		return nil, fmt.Errorf("invalid current version %q: %w", s.currentVersion, err)
	}
	latest, err := semver.NewVersion(manifest.Version)
	if err != nil {
		slog.Error("manifest version is invalid", "version", manifest.Version, "error", err)
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
		slog.Info("update available", "current", s.currentVersion, "latest", manifest.Version)
		url, err := resolvePlatformURL(manifest.Platforms)
		if err != nil {
			return nil, err
		}
		info.DownloadURL = url
	}

	return info, nil
}

// Downloads the update artifact and hands off to the platform-specific installer
func (s *UpdateService) DownloadAndInstall(downloadURL string) error {
	ext := strings.ToLower(filepath.Ext(downloadURL))
	if runtime.GOOS == "linux" && ext == "" {
		ext = ".bin" // raw binary has no extension in the URL
	}

	tmpFile, err := os.CreateTemp("", "app-update-*"+ext)
	if err != nil {
		return fmt.Errorf("creating temp update file: %w", err)
	}
	defer tmpFile.Close()
	tmpPath := tmpFile.Name()

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
		installErr = fmt.Errorf("downloading update: %w", err)
		return installErr
	}
	// Ensure all bytes are flushed before the installer reads the file.
	tmpFile.Close()

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
		switch ext {
		case ".appimage":
			installErr = s.installLinuxExecutable(tmpPath, "appimage")
		case ".deb":
			installErr = s.installLinuxDeb(tmpPath)
		default:
			installErr = s.installLinuxExecutable(tmpPath, "binary")
		}
	default:
		installErr = fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	return installErr
}

func (s *UpdateService) downloadWithProgress(url string, dest io.Writer) error {
	resp, err := s.fetchWithRetry(url, 3)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	total := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			written, writeErr := dest.Write(buf[:n])
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
			if writeErr != nil {
				return writeErr
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	return nil
}

// ── Windows ──────────────────────────────────────────────────────────────────

func (s *UpdateService) installWindows(path string) error {
	// NSIS silent flag; swap /S for /SILENT if you use Inno Setup.
	cmd := exec.Command(path, "/S")
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting Windows installer: %w", err)
	}
	time.Sleep(500 * time.Millisecond)
	os.Exit(0)
	return nil
}

func (s *UpdateService) installWindowsPortable(tmpPath string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return err
	}

	script := fmt.Sprintf(`@echo off
timeout /t 1 /nobreak >nul
copy /y "%s" "%s"
start "" "%s"
`, tmpPath, self, self)

	sf, err := os.CreateTemp("", "app-update-*.bat")
	if err != nil {
		return err
	}
	sf.WriteString(script)
	sf.Close()

	if err := exec.Command("cmd", "/C", sf.Name()).Start(); err != nil {
		return fmt.Errorf("starting portable update script: %w", err)
	}
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

// ── macOS ─────────────────────────────────────────────────────────────────────

func (s *UpdateService) installDarwin(path string) error {
	if err := exec.Command("open", path).Run(); err != nil {
		return fmt.Errorf("opening dmg installer: %w", err)
	}
	return nil
}

// ── Linux ─────────────────────────────────────────────────────────────────────

// installLinuxExecutable handles both raw binaries and AppImages — they are
// installed identically: make executable, copy over self via a shell script,
// then relaunch.
func (s *UpdateService) installLinuxExecutable(tmpPath, kind string) error {
	if err := os.Chmod(tmpPath, 0755); err != nil {
		return fmt.Errorf("chmod %s: %w", kind, err)
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

	sf, err := os.CreateTemp("", "app-update-*.sh")
	if err != nil {
		return err
	}
	sf.WriteString(script)
	sf.Close()
	os.Chmod(sf.Name(), 0755)

	if err := exec.Command("/bin/sh", sf.Name()).Start(); err != nil {
		return fmt.Errorf("starting linux %s update script: %w", kind, err)
	}
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

func (s *UpdateService) installLinuxDeb(tmpPath string) error {
	cmd := exec.Command("dpkg", "-i", tmpPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
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

	if err := exec.Command(self).Start(); err != nil {
		return fmt.Errorf("relaunching after deb install: %w", err)
	}
	time.Sleep(200 * time.Millisecond)
	os.Exit(0)
	return nil
}

func (s *UpdateService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	slog.Info("Updater service started")
	s.app = application.Get()
	s.OnProgress = func(p DownloadProgress) {
		s.app.Event.Emit("updater:progress", p)
	}
	return nil
}

func (s *UpdateService) ServiceShutdown() error {
	slog.Info("Updater service shutting down")
	return nil
}
