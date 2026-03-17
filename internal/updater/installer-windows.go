//go:build windows

package updater

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"

	"golang.org/x/sys/windows"
)

// RestartApp spawns a new process and exits the current one.
// Windows has no exec(2) equivalent — a new process must be spawned.
func restartApp() error {
	self, err := resolveExecutable()
	if err != nil {
		return fmt.Errorf("resolving executable: %w", err)
	}
	cmd := exec.Command(self, os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting new process: %w", err)
	}
	os.Exit(0)
	return nil
}

func runInstaller(key, tmpPath string, p Platform) error {
	switch p.Variant {
	case "portable":
		slog.Info("windows portable install", "key", key)
		return installWindowsPortable(tmpPath)
	case "installer":
		slog.Info("windows installer install", "key", key)
		return installWindows(tmpPath)
	default:
		slog.Error("unsupported windows variant", "variant", p.Variant)
		return fmt.Errorf("unsupported windows variant: %s", p.Variant)
	}
}

func installWindows(path string) error {
	exePath := path + ".exe"
	if err := os.Rename(path, exePath); err != nil {
		slog.Error("failed to rename installer", "path", path, "error", err)
		return fmt.Errorf("renaming installer: %w", err)
	}

	verb, err := windows.UTF16PtrFromString("runas")
	if err != nil {
		return fmt.Errorf("encoding verb: %w", err)
	}
	file, err := windows.UTF16PtrFromString(exePath)
	if err != nil {
		return fmt.Errorf("encoding installer path: %w", err)
	}
	args, err := windows.UTF16PtrFromString("/S")
	if err != nil {
		return fmt.Errorf("encoding installer args: %w", err)
	}

	slog.Info("launching elevated installer", "path", exePath)
	if err := windows.ShellExecute(0, verb, file, args, nil, windows.SW_SHOWNORMAL); err != nil {
		slog.Error("failed to launch installer", "path", exePath, "error", err)
		return fmt.Errorf("launching installer: %w", err)
	}

	return nil
}

func installWindowsPortable(tmpPath string) error {
	self, err := resolveExecutable()
	if err != nil {
		return err
	}
	return applyUpdate(tmpPath, self)
}

// applyUpdate is the go-update-style in-process swap:
//
//  1. sync tmpPath to disk
//  2. rename target     → .old
//  3. rename tmpPath    → target
//  4. try to remove .old; if that fails (always on Windows), hide it
func applyUpdate(tmpPath, target string) error {
	if err := syncFile(tmpPath); err != nil {
		return fmt.Errorf("syncing update file: %w", err)
	}

	dir := filepath.Dir(target)
	base := filepath.Base(target)
	oldPath := filepath.Join(dir, "."+base+".old")

	// Remove any leftover .old from a previous update attempt.
	// On Windows this is necessary because rename fails if dst exists.
	_ = os.Remove(oldPath)

	if err := os.Rename(target, oldPath); err != nil {
		slog.Error("failed to move target to .old", "error", err)
		return fmt.Errorf("moving target to .old: %w", err)
	}

	if err := os.Rename(tmpPath, target); err != nil {
		// Rollback
		if rerr := os.Rename(oldPath, target); rerr != nil {
			slog.Error("rollback failed", "error", rerr)
		}
		slog.Error("failed to move new binary into place", "error", err)
		return fmt.Errorf("moving new binary into place: %w", err)
	}

	// Remove .old — on Windows this will fail because the process is
	// still running, so hide it instead (identical to go-update).
	if err := os.Remove(oldPath); err != nil {
		_ = hideFile(oldPath)
	}

	slog.Info("update applied, waiting for user restart")
	return nil
}

func hideFile(path string) error {
	ptr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return fmt.Errorf("encoding path: %w", err)
	}
	attrs, err := windows.GetFileAttributes(ptr)
	if err != nil {
		return fmt.Errorf("getting file attributes: %w", err)
	}
	if err := windows.SetFileAttributes(ptr, attrs|windows.FILE_ATTRIBUTE_HIDDEN); err != nil {
		return fmt.Errorf("setting hidden attribute: %w", err)
	}
	return nil
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

func writeAndSync(path string, r io.Reader, mode os.FileMode) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC|os.O_EXCL, mode)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(path)
		return fmt.Errorf("writing file: %w", err)
	}
	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(path)
		return fmt.Errorf("syncing file: %w", err)
	}
	return f.Close()
}
