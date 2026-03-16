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
	"syscall"
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

func (s *UpdateService) downloadWithProgress(url string, dest io.Writer) error {
	resp, err := s.fetchWithRetry(url, 3)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	total := resp.ContentLength
	var downloaded int64
	var lastLoggedPct int
	buf := make([]byte, 32*1024)
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			written, writeErr := dest.Write(buf[:n])
			downloaded += int64(written)
			if writeErr != nil {
				return writeErr
			}
			pct := 0
			if total > 0 {
				pct = int(downloaded * 100 / total)
			}
			if pct/20 > lastLoggedPct/20 {
				slog.Info("download progress", "percent", pct, "downloaded", downloaded, "total", total)
				lastLoggedPct = pct
			}
			if s.OnProgress != nil {
				s.OnProgress(DownloadProgress{
					BytesDownloaded: downloaded,
					TotalBytes:      total,
					Percent:         pct,
				})
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
		key, err := manifestKey()
		if err != nil {
			slog.Error("failed to fetch update manifest", "error", err, "url", s.manifestURL)
			return nil, err
		}
		slog.Error("failed to fetch update manifest", "error", err, "url", s.manifestURL, "key", key)
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

func (s *UpdateService) downloadToFile(downloadURL, tmpPath string) error {
	tmpFile, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0600)
	if err != nil {
		slog.Error("failed to create temp update file", "path", tmpPath, "error", err)
		return fmt.Errorf("creating temp update file: %w", err)
	}
	defer tmpFile.Close()

	if err := s.downloadWithProgress(downloadURL, tmpFile); err != nil {
		slog.Error("failed to download update", "url", downloadURL, "error", err)
		return fmt.Errorf("downloading update: %w", err)
	}
	return nil
}

// Downloads the update artifact and hands off to the platform-specific installer
func (s *UpdateService) DownloadAndInstall(downloadURL string) error {
	key, err := manifestKey()
	if err != nil {
		return err
	}

	tmpDir, err := os.MkdirTemp("", "app-update-*")
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

	slog.Info("starting update download",
		"url", downloadURL,
		"key", key,
		"temp_path", tmpPath,
	)

	if err := s.downloadToFile(downloadURL, tmpPath); err != nil {
		os.RemoveAll(tmpDir)
		return err
	}

	var installErr error
	defer func() {
		if installErr != nil {
			slog.Error("install failed, cleaning up temp dir", "path", tmpDir, "error", installErr)
			os.RemoveAll(tmpDir)
		}
	}()

	switch {
	case strings.HasPrefix(key, "windows") && isPortableWindows():
		slog.Info("running windows portable install", "key", key, "path", tmpPath)
		installErr = s.installWindowsPortable(tmpPath)
	case strings.HasPrefix(key, "windows"):
		slog.Info("running windows installer", "key", key, "path", tmpPath)
		installErr = s.installWindows(tmpPath)
	case strings.HasPrefix(key, "darwin"):
		slog.Info("running darwin install", "key", key, "path", tmpPath)
		installErr = s.installDarwin(tmpPath)
	case strings.HasSuffix(key, "-deb"):
		slog.Info("running linux deb install", "key", key, "path", tmpPath)
		installErr = s.installLinuxDeb(tmpPath)
	case strings.HasPrefix(key, "linux"):
		slog.Info("running linux binary install", "key", key, "path", tmpPath)
		installErr = s.installLinuxExecutable(tmpPath, "binary")
	default:
		slog.Error("unsupported manifest key, aborting install", "key", key)
		installErr = fmt.Errorf("unsupported manifest key: %s", key)
	}
	return installErr
}

// Windows

// Escapes a filesystem path for safe interpolation into a
// double-quoted PowerShell string: backslashes are fine as-is in PS
// double-quoted strings, but we must escape $ and " characters.
func escapePSPath(p string) string {
	p = strings.ReplaceAll(p, "`", "``")  // escape PS backtick first
	p = strings.ReplaceAll(p, "$", "`$")  // escape variable sigil
	p = strings.ReplaceAll(p, `"`, "`\"") // escape double-quote
	return `"` + p + `"`
}

func (s *UpdateService) installWindows(path string) error {
	// Rename to .exe so Windows doesn't block execution from temp dir
	exePath := path + ".exe"
	if err := os.Rename(path, exePath); err != nil {
		return fmt.Errorf("renaming installer: %w", err)
	}

	cmd := exec.Command(exePath, "/S")
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP}
	if err := cmd.Start(); err != nil {
		os.Remove(exePath)
		return fmt.Errorf("starting Windows installer: %w", err)
	}

	// Don't delete — let NSIS finish reading its own exe.
	// The installer itself or OS temp cleanup will handle it.
	os.Exit(0)
	return nil
}

func (s *UpdateService) installWindowsPortable(tmpPath string) error {
	self, err := os.Executable()
	if err != nil {
		slog.Error("failed to resolve executable path", "error", err)
		return fmt.Errorf("resolving executable: %w", err)
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		slog.Error("failed to evaluate symlinks", "path", self, "error", err)
		return fmt.Errorf("evaluating symlinks: %w", err)
	}
	self = filepath.Clean(self)

	oldPath := self + ".old"
	if err := os.Rename(self, oldPath); err != nil {
		slog.Error("failed to move current executable", "path", self, "old_path", oldPath, "error", err)
		return fmt.Errorf("moving current executable: %w", err)
	}

	if err := os.Rename(tmpPath, self); err != nil {
		os.Rename(oldPath, self)
		slog.Error("failed to move new executable into place", "tmp_path", tmpPath, "dest", self, "error", err)
		return fmt.Errorf("moving new executable into place: %w", err)
	}

	// Launch a PS script that waits for our PID to exit, then deletes the .old file.
	pid := os.Getpid()

	// Poll until our process has fully exited before touching the file it had open
	// Delete the .old file now that the lock has been released
	// Self-delete this script
	psScript := fmt.Sprintf(`
while (Get-Process -Id %d -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 200
}
Remove-Item -Path %s -Force -ErrorAction SilentlyContinue
Remove-Item -Path $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
`,
		pid,
		escapePSPath(oldPath),
	)

	psFile, err := os.CreateTemp("", "app-cleanup-*.ps1")
	if err != nil {
		slog.Error("failed to create cleanup script", "error", err)
		return fmt.Errorf("creating cleanup script: %w", err)
	}
	if _, err := psFile.WriteString(psScript); err != nil {
		psFile.Close()
		os.Remove(psFile.Name())
		slog.Error("failed to write cleanup script", "error", err)
		return fmt.Errorf("writing cleanup script: %w", err)
	}
	psFile.Close()

	cmd := exec.Command(
		"powershell",
		"-NonInteractive", "-NoProfile", "-ExecutionPolicy", "Bypass",
		"-File", psFile.Name(),
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP}
	if err := cmd.Start(); err != nil {
		slog.Error("failed to start cleanup script", "error", err)
		return fmt.Errorf("starting cleanup script: %w", err)
	}

	newCmd := exec.Command(self)
	newCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP}
	if err := newCmd.Start(); err != nil {
		// Relaunch failed - roll back: restore the old binary so the user
		// isn't left with a broken installation
		if rerr := os.Rename(oldPath, self); rerr != nil {
			slog.Error("rollback failed after relaunch failure",
				"old_path", oldPath, "self", self, "rollback_error", rerr)
		}
		slog.Error("failed to relaunch updated executable", "path", self, "error", err)
		return fmt.Errorf("relaunching updated executable: %w", err)
	}

	os.Exit(0)
	return nil
}

// macOS

func (s *UpdateService) installDarwin(path string) error {
	// Mount the DMG quietly.
	mountOut, err := exec.Command("hdiutil", "attach", path, "-nobrowse", "-quiet").Output()
	if err != nil {
		slog.Error("failed to mount dmg", "path", path, "error", err)
		return fmt.Errorf("mounting dmg: %w", err)
	}

	// Parse the mount point from hdiutil output — last tab-separated field of the last line.
	var mountPoint string
	for line := range strings.SplitSeq(strings.TrimSpace(string(mountOut)), "\n") {
		parts := strings.Split(line, "\t")
		if len(parts) >= 3 {
			mountPoint = strings.TrimSpace(parts[len(parts)-1])
		}
	}
	if mountPoint == "" {
		slog.Error("failed to parse dmg mount point", "output", string(mountOut))
		return fmt.Errorf("could not determine dmg mount point")
	}
	slog.Info("dmg mounted", "mount_point", mountPoint)

	defer func() {
		exec.Command("hdiutil", "detach", mountPoint, "-quiet").Run()
		os.Remove(path)
	}()

	// Find the .app bundle inside the mounted volume.
	entries, err := os.ReadDir(mountPoint)
	if err != nil {
		slog.Error("failed to read mounted dmg", "mount_point", mountPoint, "error", err)
		return fmt.Errorf("reading dmg contents: %w", err)
	}
	var appName string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".app") {
			appName = e.Name()
			break
		}
	}
	if appName == "" {
		slog.Error("no .app found in dmg", "mount_point", mountPoint)
		return fmt.Errorf("no .app bundle found in dmg")
	}

	src := filepath.Join(mountPoint, appName)
	dst := filepath.Join("/Applications", appName)

	// Remove the old version first, then copy the new one.
	os.RemoveAll(dst)
	if out, err := exec.Command("cp", "-R", src, dst).CombinedOutput(); err != nil {
		slog.Error("failed to copy app to /Applications", "src", src, "dst", dst, "error", err, "output", string(out))
		return fmt.Errorf("copying app to /Applications: %w", err)
	}
	slog.Info("app installed to /Applications", "path", dst)

	exec.Command("hdiutil", "detach", mountPoint, "-quiet").Run()
	os.Remove(path)

	// Relaunch from /Applications and exit.
	if err := exec.Command("open", dst).Start(); err != nil {
		slog.Error("failed to relaunch app", "path", dst, "error", err)
		return fmt.Errorf("relaunching app: %w", err)
	}

	os.Exit(0)
	return nil
}

// Linux

// Wraps a path in single quotes and escapes any embedded single quotes.
func singleQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

func (s *UpdateService) installLinuxExecutable(tmpPath, kind string) error {
	if err := os.Chmod(tmpPath, 0755); err != nil {
		slog.Error("failed to chmod update binary", "kind", kind, "path", tmpPath, "error", err)
		return fmt.Errorf("chmod %s: %w", kind, err)
	}

	self, err := os.Executable()
	if err != nil {
		slog.Error("failed to resolve executable path", "error", err)
		return fmt.Errorf("resolving executable: %w", err)
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		slog.Error("failed to evaluate symlinks", "path", self, "error", err)
		return fmt.Errorf("evaluating symlinks: %w", err)
	}
	self = filepath.Clean(self)

	pid := os.Getpid()
	// Poll until our PID is gone, then replace the binary and relaunch.
	script := fmt.Sprintf(`#!/bin/sh
while kill -0 %d 2>/dev/null; do
    sleep 0.2
done
if cp %s %s; then
    chmod +x %s
    rm -- %s
    %s &
else
    echo "update cp failed, aborting" >&2
fi
rm -- "$0"
`, pid,
		singleQuote(tmpPath), singleQuote(self),
		singleQuote(self),
		singleQuote(tmpPath),
		singleQuote(self),
	)

	sf, err := os.CreateTemp("", "app-update-*.sh")
	if err != nil {
		slog.Error("failed to create update script", "error", err)
		return fmt.Errorf("creating update script: %w", err)
	}
	if _, err := sf.WriteString(script); err != nil {
		sf.Close()
		os.Remove(sf.Name())
		slog.Error("failed to write update script", "error", err)
		return fmt.Errorf("writing update script: %w", err)
	}
	sf.Close()

	if err := os.Chmod(sf.Name(), 0755); err != nil {
		os.Remove(sf.Name())
		slog.Error("failed to chmod update script", "error", err)
		return fmt.Errorf("chmod update script: %w", err)
	}

	if err := exec.Command("/bin/sh", sf.Name()).Start(); err != nil {
		os.Remove(sf.Name())
		slog.Error("failed to start update script", "kind", kind, "error", err)
		return fmt.Errorf("starting linux %s update script: %w", kind, err)
	}

	os.Exit(0)
	return nil
}

func (s *UpdateService) installLinuxDeb(tmpPath string) error {
	// Resolve the current executable path before dpkg potentially replaces it
	self, err := os.Executable()
	if err != nil {
		slog.Error("failed to resolve executable path", "error", err)
		return fmt.Errorf("resolving executable: %w", err)
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		slog.Error("failed to evaluate symlinks", "path", self, "error", err)
		return fmt.Errorf("evaluating symlinks: %w", err)
	}
	self = filepath.Clean(self)

	// pkexec prompts the user for their password to run dpkg as root
	cmd := exec.Command("pkexec", "dpkg", "-i", tmpPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		slog.Error("dpkg install failed", "path", tmpPath, "error", err)
		return fmt.Errorf("dpkg install failed: %w", err)
	}

	// dpkg is done with the file, clean it up
	os.Remove(tmpPath)

	// Relaunch the freshly installed binary and exit
	if err := exec.Command(self).Start(); err != nil {
		slog.Error("failed to relaunch after deb install", "path", self, "error", err)
		return fmt.Errorf("relaunching after deb install: %w", err)
	}

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
