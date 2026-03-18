//go:build linux

package updater

import (
	"fmt"
	"io"
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

// WHY NOT os.Executable()?
// On Linux, os.Executable() reads /proc/self/exe, which is a kernel symlink
// to the inode the process was started from.  After applyUpdate renames the
// new binary over the old path, /proc/self/exe still resolves to the *old*
// inode (the kernel keeps it alive as long as the process holds it open).
// syscall.Exec on that path would therefore re-launch the old version.
//
// FIX: rebuild the absolute path from os.Args[0] + working directory so we
// walk the filesystem and always land on whatever inode sits at that path
// right now - i.e. the freshly installed binary
func restartApp(installerPath string) error {
	self, err := executableFromArgs()
	if err != nil {
		return err
	}
	slog.Info("restarting into new binary", "path", self)
	return syscall.Exec(self, os.Args, os.Environ())
}

// Returns the absolute, symlink-resolved path to the
// binary by interpreting os.Args[0] relative to the working directory.
// This follows the on-disk path, not /proc/self/exe
func executableFromArgs() (string, error) {
	arg0 := os.Args[0]

	if !filepath.IsAbs(arg0) {
		wd, err := os.Getwd()
		if err != nil {
			return "", fmt.Errorf("getting working directory: %w", err)
		}
		arg0 = filepath.Join(wd, arg0)
	}

	resolved, err := filepath.EvalSymlinks(arg0)
	if err != nil {
		// Symlink resolution can fail if the old binary was already removed;
		// fall back to the cleaned absolute path and let Exec surface any error.
		slog.Warn("could not eval symlinks for restart path, using cleaned path", "path", arg0, "error", err)
		return filepath.Clean(arg0), nil
	}
	return filepath.Clean(resolved), nil
}

func runInstaller(key, tmpPath string, p Platform) (string, error) {
	switch p.Variant {
	case "raw":
		slog.Info("linux binary install", "key", key)
		return "", installLinuxExecutable(tmpPath)
	case "deb":
		slog.Info("linux deb install", "key", key)
		return "", installLinuxDeb(tmpPath)
	default:
		slog.Error("unsupported linux variant", "variant", p.Variant)
		return "", fmt.Errorf("unsupported linux variant: %s", p.Variant)
	}
}

func installLinuxExecutable(tmpPath string) error {
	if err := os.Chmod(tmpPath, 0755); err != nil {
		slog.Error("failed to chmod update binary", "path", tmpPath, "error", err)
		return fmt.Errorf("chmod binary: %w", err)
	}

	self, err := resolveExecutable()
	if err != nil {
		return err
	}

	// On Linux, rename(2) is atomic and the running process holds
	// the old inode open - so we can rename freely over the path.
	return applyUpdate(tmpPath, self)
}

func installLinuxDeb(tmpPath string) error {
	slog.Info("running dpkg install", "path", tmpPath)
	cmd := exec.Command("pkexec", "dpkg", "-i", tmpPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		slog.Error("dpkg install failed", "path", tmpPath, "error", err)
		return fmt.Errorf("dpkg install: %w", err)
	}
	if err := os.Remove(tmpPath); err != nil && !os.IsNotExist(err) {
		slog.Warn("could not remove deb package", "path", tmpPath, "error", err)
	}

	slog.Info("deb update applied, waiting for user restart")
	return nil
}

// applyUpdate atomically replaces the running binary with the downloaded update.
// Steps:
//  1. sync tmpPath to disk
//  2. rename target  → .old  (atomic on same device)
//  3. rename tmpPath → target (atomic on same device, falls back to copy if cross-device)
//  4. remove .old
//
// Cross-device fallback exists because portable binaries can live anywhere -
// including on a different filesystem from the OS temp directory.
func applyUpdate(tmpPath, target string) error {
	if err := syncFile(tmpPath); err != nil {
		return fmt.Errorf("syncing update file: %w", err)
	}

	dir := filepath.Dir(target)
	base := filepath.Base(target)
	oldPath := filepath.Join(dir, "."+base+".old")
	_ = os.Remove(oldPath)

	if err := os.Rename(target, oldPath); err != nil {
		slog.Error("failed to move target to .old", "error", err)
		return fmt.Errorf("moving target to .old: %w", err)
	}

	if err := os.Rename(tmpPath, target); err != nil {
		// Cross-device: fall back to copy
		if isCrossDevice(err) {
			if cerr := copyFile(tmpPath, target); cerr != nil {
				_ = os.Rename(oldPath, target) // rollback
				return fmt.Errorf("copying new binary into place: %w", cerr)
			}
			_ = os.Remove(tmpPath)
		} else {
			_ = os.Rename(oldPath, target) // rollback
			return fmt.Errorf("moving new binary into place: %w", err)
		}
	}

	_ = os.Remove(oldPath)
	slog.Info("update applied, waiting for user restart")
	return nil
}

func isCrossDevice(err error) bool {
	if le, ok := err.(*os.LinkError); ok {
		return le.Err == syscall.EXDEV
	}
	return false
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func syncFile(path string) error {
	f, err := os.OpenFile(path, os.O_WRONLY, 0)
	if err != nil {
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

func singleQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
