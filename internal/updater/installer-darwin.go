//go:build darwin

package updater

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func RunWatchdogIfRequested() bool {
	return false
}

// RestartApp re-execs the current binary in-place.
// The OS replaces the current process image - PID stays the same,
// so no orphan processes and no need to manage child PIDs.
func restartApp(installerPath string) error {
	self, err := resolveExecutable()
	if err != nil {
		return fmt.Errorf("resolving executable: %w", err)
	}
	return syscall.Exec(self, os.Args, os.Environ())
}

func runInstaller(key, tmpPath string, p Platform) (string, error) {
	switch {
	case strings.HasPrefix(key, "darwin"):
		slog.Info("darwin install", "key", key)
		return "", installDarwin(tmpPath)
	default:
		slog.Error("unsupported manifest key", "key", key)
		return "", fmt.Errorf("unsupported manifest key: %s", key)
	}
}

func installDarwin(path string) error {
	mountOut, err := exec.Command("hdiutil", "attach", path, "-nobrowse", "-quiet").Output()
	if err != nil {
		slog.Error("failed to mount dmg", "path", path, "error", err)
		return fmt.Errorf("mounting dmg: %w", err)
	}

	mountPoint, err := parseDMGMountPoint(string(mountOut))
	if err != nil {
		slog.Error("failed to parse dmg mount point", "output", string(mountOut))
		return err
	}
	slog.Info("dmg mounted", "mount_point", mountPoint)

	defer func() {
		if err := exec.Command("hdiutil", "detach", mountPoint, "-quiet").Run(); err != nil {
			slog.Warn("failed to detach dmg", "mount_point", mountPoint, "error", err)
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			slog.Warn("failed to remove dmg file", "path", path, "error", err)
		}
	}()

	appName, err := findAppBundle(mountPoint)
	if err != nil {
		slog.Error("no .app found in dmg", "mount_point", mountPoint)
		return err
	}

	src := filepath.Join(mountPoint, appName)
	dst := filepath.Join("/Applications", appName)

	slog.Info("installing app", "src", src, "dst", dst)
	if err := copyAppElevated(src, dst); err != nil {
		return err
	}

	slog.Info("darwin update applied, waiting for user restart")
	return nil
}

// copyAppElevated follows the same .old swap pattern as go-update,
// but via osascript since /Applications requires admin privileges:
//
//  1. cp src   → dst.new   (elevated)
//  2. mv dst   → dst.old   (elevated, atomic within /Applications)
//  3. mv dst.new → dst     (elevated, atomic within /Applications)
//  4. rm dst.old           (elevated, best-effort)
func copyAppElevated(src, dst string) error {
	dstNew := dst + ".new"
	dstOld := dst + ".old"

	shCmd := fmt.Sprintf(
		"cp -R %s %s && mv -f %s %s && mv -f %s %s; rm -rf %s",
		shellQuote(src), shellQuote(dstNew),
		shellQuote(dst), shellQuote(dstOld),
		shellQuote(dstNew), shellQuote(dst),
		shellQuote(dstOld),
	)
	script := fmt.Sprintf(
		`do shell script "sh -c %s" with administrator privileges`,
		osascriptQuote(shCmd),
	)

	out, err := exec.Command("osascript", "-e", script).CombinedOutput()
	if err != nil {
		slog.Error("elevated copy failed", "src", src, "dst", dst, "output", string(out), "error", err)
		_ = exec.Command("osascript", "-e", fmt.Sprintf(
			`do shell script "mv -f %s %s" with administrator privileges`,
			osascriptQuote(dstOld), osascriptQuote(dst),
		)).Run()
		return fmt.Errorf("installing app to /Applications: %w (output: %s)", err, out)
	}
	return nil
}

func parseDMGMountPoint(out string) (string, error) {
	var mountPoint string
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		parts := strings.Split(line, "\t")
		if len(parts) >= 3 {
			mountPoint = strings.TrimSpace(parts[len(parts)-1])
		}
	}
	if mountPoint == "" {
		return "", fmt.Errorf("could not determine dmg mount point from: %q", out)
	}
	return mountPoint, nil
}

func findAppBundle(mountPoint string) (string, error) {
	entries, err := os.ReadDir(mountPoint)
	if err != nil {
		return "", fmt.Errorf("reading dmg contents: %w", err)
	}
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".app") {
			return e.Name(), nil
		}
	}
	return "", fmt.Errorf("no .app bundle found in dmg at %q", mountPoint)
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

func osascriptQuote(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return `"` + s + `"`
}
