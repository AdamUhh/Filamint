package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Public types
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

// Allows tests to inject a fake transport
type HTTPClient interface {
	Get(url string) (*http.Response, error)
}

type UpdateService struct {
	currentVersion  string
	manifestURL     string
	client          HTTPClient
	platform        Platform
	app             *application.App
	OnProgress      func(DownloadProgress)
	stagedInstaller string // path to staged NSIS .exe (installer variant only)

	mu       sync.Mutex
	cond     *sync.Cond
	inflight bool
	cache    cachedResult
}

type cachedResult struct {
	info *UpdateInfo
	err  error
	at   time.Time
	ttl  time.Duration
}

func (c *cachedResult) valid() bool {
	return !c.at.IsZero() && time.Since(c.at) < c.ttl
}

func NewUpdater(currentVersion, manifestURL string) *UpdateService {
	s := &UpdateService{
		currentVersion: currentVersion,
		manifestURL:    manifestURL,
		client:         &http.Client{Timeout: 30 * time.Second},
		platform:       DetectPlatform(),
		cache:          cachedResult{ttl: 10 * time.Minute},
	}
	s.cond = sync.NewCond(&s.mu)
	return s
}

func (s *UpdateService) RestartApp() error {
	err := restartApp(s.stagedInstaller)
	if err != nil {
		slog.Error("Failed to restart app", "error", err)
		return fmt.Errorf("Failed to restart app: %w", err)
	}
	return nil
}

// Returns cached results when fresh; otherwise fetches the manifest.
// Concurrent callers wait for the single in-flight request to
// finish before reading from the cache.
func (s *UpdateService) CheckForUpdate() (*UpdateInfo, error) {
	s.mu.Lock()
	for s.inflight {
		s.cond.Wait()
	}
	if s.cache.valid() {
		info, err := s.cache.info, s.cache.err
		s.mu.Unlock()
		return info, err
	}
	s.inflight = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.inflight = false
		s.cond.Broadcast()
		s.mu.Unlock()
	}()

	info, err := s.fetchAndParse()

	s.mu.Lock()
	s.cache.info, s.cache.err, s.cache.at = info, err, time.Now()
	s.mu.Unlock()

	return info, err
}

func (s *UpdateService) fetchAndParse() (*UpdateInfo, error) {
	resp, err := fetchWithRetry(s.client, s.manifestURL, 1)
	if err != nil {
		slog.Error("failed to fetch update manifest", "url", s.manifestURL, "error", err)
		return nil, fmt.Errorf("fetching update manifest: %w", err)
	}
	defer resp.Body.Close()

	var m Manifest
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		slog.Error("failed to parse update manifest", "error", err)
		return nil, fmt.Errorf("parsing update manifest: %w", err)
	}

	current, err := semver.NewVersion(s.currentVersion)
	if err != nil {
		slog.Error("current version is invalid", "version", s.currentVersion, "error", err)
		return nil, fmt.Errorf("invalid current version %q: %w", s.currentVersion, err)
	}
	latest, err := semver.NewVersion(m.Version)
	if err != nil {
		slog.Error("manifest version is invalid", "version", m.Version, "error", err)
		return nil, fmt.Errorf("invalid manifest version %q: %w", m.Version, err)
	}

	info := &UpdateInfo{
		CurrentVersion: s.currentVersion,
		NewVersion:     m.Version,
		Notes:          m.Notes,
		PubDate:        m.PubDate,
		Available:      latest.GreaterThan(current),
	}
	if info.Available {
		slog.Info("update available", "current", s.currentVersion, "latest", m.Version)
		if info.DownloadURL, err = resolvePlatformURL(m.Platforms, s.platform); err != nil {
			return nil, err
		}
	}
	return info, nil
}

// Downloads the artifact and runs the platform installer
func (s *UpdateService) DownloadAndInstall(downloadURL string) error {
	key, err := s.platform.ManifestKey()
	if err != nil {
		return err
	}

	tmpDir, err := makeTempUpdateDir(s.platform)
	if err != nil {
		slog.Error("failed to create temp update dir", "error", err)
		return fmt.Errorf("creating temp update dir: %w", err)
	}

	if err := os.Chmod(tmpDir, 0700); err != nil {
		slog.Error("failed to chmod temp update dir", "path", tmpDir, "error", err)
		os.RemoveAll(tmpDir)
		return fmt.Errorf("chmod temp update dir: %w", err)
	}

	tmpPath := filepath.Join(tmpDir, "update")
	slog.Info("starting update download", "url", downloadURL, "key", key, "temp_path", tmpPath)

	if err := s.downloadToFile(downloadURL, tmpPath); err != nil {
		os.RemoveAll(tmpDir)
		return err
	}

	installerPath, installErr := runInstaller(key, tmpPath, s.platform)
	if installErr != nil {
		slog.Error("install failed, cleaning up", "path", tmpDir, "error", installErr)
		os.RemoveAll(tmpDir)

		s.app.Event.Emit("updater:fail")
	} else {
		s.stagedInstaller = installerPath
		s.app.Event.Emit("updater:restart")
	}

	return installErr
}

func (s *UpdateService) downloadToFile(url, dst string) error {
	f, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0600)
	if err != nil {
		slog.Error("failed to create temp update file", "path", dst, "error", err)
		return fmt.Errorf("creating temp file: %w", err)
	}
	defer f.Close()

	resp, err := fetchWithRetry(s.client, url, 1)
	if err != nil {
		slog.Error("failed to download update", "url", url, "error", err)
		return fmt.Errorf("downloading update: %w", err)
	}
	defer resp.Body.Close()

	pw := &progressWriter{dest: f, total: resp.ContentLength, onProgress: s.OnProgress}
	if _, err := io.Copy(pw, resp.Body); err != nil {
		slog.Error("failed to write update file", "path", dst, "error", err)
		return fmt.Errorf("writing update file: %w", err)
	}
	return nil
}

// Helpers

// Performs a GET with exponential backoff
func fetchWithRetry(client HTTPClient, url string, maxAttempts int) (*http.Response, error) {
	backoff := time.Second
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == http.StatusOK {
			return resp, nil
		}
		if err == nil {
			resp.Body.Close()
			lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
		} else {
			lastErr = err
		}
		slog.Warn("update request failed", "attempt", attempt, "max", maxAttempts, "backoff", backoff, "error", lastErr)
		if attempt < maxAttempts {
			time.Sleep(backoff)
			backoff *= 2
		}
	}
	return nil, fmt.Errorf("all %d attempts failed: %w", maxAttempts, lastErr)
}

// Picks the download URL for the current platform
func resolvePlatformURL(platforms map[string]PlatformManifest, p Platform) (string, error) {
	key, err := p.ManifestKey()
	if err != nil {
		return "", err
	}
	pm, ok := platforms[key]
	if !ok || pm.URL == "" {
		slog.Error("no update url found for platform", "key", key)
		return "", fmt.Errorf("no update URL for platform %q", key)
	}
	slog.Info("resolved update url", "key", key, "url", pm.URL)
	return pm.URL, nil
}

// Returns the cleaned, symlink-resolved path to the running binary
func resolveExecutable() (string, error) {
	self, err := os.Executable()
	if err != nil {
		slog.Error("failed to resolve executable path", "error", err)
		return "", fmt.Errorf("resolving executable: %w", err)
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		slog.Error("failed to evaluate symlinks", "path", self, "error", err)
		return "", fmt.Errorf("evaluating symlinks: %w", err)
	}
	return filepath.Clean(self), nil
}

type progressWriter struct {
	dest       io.Writer
	total      int64
	downloaded int64
	lastLogged int
	onProgress func(DownloadProgress)
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.dest.Write(p)
	pw.downloaded += int64(n)

	pct := 0
	if pw.total > 0 {
		pct = int(pw.downloaded * 100 / pw.total)
	}
	if pct/20 > pw.lastLogged/20 {
		slog.Info("download progress", "percent", pct, "downloaded", pw.downloaded, "total", pw.total)
		pw.lastLogged = pct
	}
	if pw.onProgress != nil {
		pw.onProgress(DownloadProgress{BytesDownloaded: pw.downloaded, TotalBytes: pw.total, Percent: pct})
	}
	return n, err
}

// Picks the right temp directory based on platform/variant:
//
//   - Windows portable: same drive as the binary, because applyUpdate uses
//     os.Rename which fails across drive letters (ERROR_NOT_SAME_DEVICE).
//
//   - Windows installer: os.TempDir() (%TEMP%) - the binary lives in
//     Program Files and is not writable without elevation. NSIS handles
//     the actual file placement, so cross-drive is irrelevant.
//
//   - All other platforms: os.TempDir() is always fine.
func makeTempUpdateDir(p Platform) (string, error) {
	var base string
	if p.IsPortableWindows() {
		self, err := resolveExecutable()
		if err != nil {
			return "", err
		}
		base = filepath.Dir(self) // same drive as binary for atomic rename
	} else {
		base = os.TempDir() // user-writable, no elevation needed
	}
	return os.MkdirTemp(base, "app-update-*")
}

func (s *UpdateService) cleanupUpdateArtifacts() {
	self, err := resolveExecutable()
	if err != nil {
		return
	}
	dir := filepath.Dir(self)
	base := filepath.Base(self)

	// .old backup — only exists for portable builds
	if s.platform.IsPortableWindows() {
		oldPath := filepath.Join(dir, "."+base+".old")
		if err := os.Remove(oldPath); err == nil {
			slog.Info("cleaned up old binary", "path", oldPath)
		}
	}

	// app-update-* temp dirs
	var scanDirs []string
	if s.platform.IsPortableWindows() {
		scanDirs = []string{dir} // portable: next to binary
	} else {
		scanDirs = []string{os.TempDir()} // installer/linux/mac: system temp
	}

	for _, scanDir := range scanDirs {
		entries, err := os.ReadDir(scanDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() && strings.HasPrefix(e.Name(), "app-update-") {
				p := filepath.Join(scanDir, e.Name())
				if err := os.RemoveAll(p); err == nil {
					slog.Info("cleaned up temp update dir", "path", p)
				}
			}
		}
	}
}

func (s *UpdateService) ServiceStartup(_ context.Context, _ application.ServiceOptions) error {
	slog.Info("updater service started")

	s.app = application.Get()
	s.OnProgress = func(p DownloadProgress) {
		s.app.Event.Emit("updater:progress", p)
	}

	// Clean up any leftover update artifacts from previous runs:
	//   - app-update-* temp dirs  (download was interrupted or install failed)
	//   - .filamint.exe.old       (held open by the old process, now released)
	go s.cleanupUpdateArtifacts()

	return nil
}

func (s *UpdateService) ServiceShutdown() error {
	slog.Info("updater service shutting down")
	return nil
}
