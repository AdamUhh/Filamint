package updater

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"

	"golang.org/x/sys/windows"
)

// NOTE: BUGS:
// Currently, it does not clean the temp updater folder/files (need to only remove those in temp)
// It is not safe code
func installWindows(path string) error {
	exePath := path + ".exe"
	if err := os.Rename(path, exePath); err != nil {
		slog.Error("failed to rename installer", "path", path, "error", err)
		return fmt.Errorf("renaming installer: %w", err)
	}

	verb, _ := windows.UTF16PtrFromString("runas")
	file, _ := windows.UTF16PtrFromString(exePath)
	args, _ := windows.UTF16PtrFromString(fmt.Sprintf("/S /PID=%d", os.Getpid()))

	if err := windows.ShellExecute(0, verb, file, args, nil, windows.SW_SHOWNORMAL); err != nil {
		slog.Error("failed to launch installer", "path", exePath, "error", err)
		return fmt.Errorf("launching installer: %w", err)
	}

	slog.Info("installer launched, exiting", "pid", os.Getpid())
	os.Exit(0)
	return nil
}

func installWindowsPortable(tmpPath string) error {
	self, err := resolveExecutable()
	if err != nil {
		return err
	}

	oldPath := self + ".old"
	if err := os.Rename(self, oldPath); err != nil {
		slog.Error("failed to move current executable", "path", self, "old_path", oldPath, "error", err)
		return fmt.Errorf("moving current executable: %w", err)
	}
	if err := os.Rename(tmpPath, self); err != nil {
		slog.Error("failed to move new executable into place", "tmp_path", tmpPath, "dest", self, "error", err)
		os.Rename(oldPath, self) // best-effort rollback
		return fmt.Errorf("moving new executable into place: %w", err)
	}

	if err := launchCleanupScriptWindows(oldPath); err != nil {
		slog.Warn("cleanup script failed to launch", "error", err)
		// Non-fatal: the .old file will linger but the update succeeded.
	}

	if err := exec.Command(self).Start(); err != nil {
		// Relaunch failed — roll back so the user is not left broken.
		if rerr := os.Rename(oldPath, self); rerr != nil {
			slog.Error("rollback failed after relaunch failure", "old_path", oldPath, "self", self, "rollback_error", rerr)
		}
		slog.Error("failed to relaunch updated executable", "path", self, "error", err)
		return fmt.Errorf("relaunching updated executable: %w", err)
	}
	return nil
}

// Helpers

// Spawns a detached PowerShell script that waits for the current PID to exit, then deletes the stale .old binary
func launchCleanupScriptWindows(oldPath string) error {
	script := fmt.Sprintf(`
while (Get-Process -Id %d -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 200
}
Remove-Item -Path %s -Force -ErrorAction SilentlyContinue
Remove-Item -Path $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
`, os.Getpid(), escapePSPath(oldPath))

	f, err := os.CreateTemp("", "app-cleanup-*.ps1")
	if err != nil {
		slog.Error("failed to create cleanup script", "error", err)
		return fmt.Errorf("creating cleanup script: %w", err)
	}
	if _, err := f.WriteString(script); err != nil {
		f.Close()
		os.Remove(f.Name())
		slog.Error("failed to write cleanup script", "error", err)
		return fmt.Errorf("writing cleanup script: %w", err)
	}
	f.Close()

	cmd := exec.Command(
		"powershell",
		"-NonInteractive", "-NoProfile", "-ExecutionPolicy", "Bypass",
		"-File", f.Name(),
	)
	if err := cmd.Start(); err != nil {
		os.Remove(f.Name())
		slog.Error("failed to start cleanup script", "error", err)
		return fmt.Errorf("starting cleanup script: %w", err)
	}
	return nil
}

// Escapes a path for safe use inside a double-quoted PowerShell string
func escapePSPath(p string) string {
	p = strings.ReplaceAll(p, "`", "``")
	p = strings.ReplaceAll(p, "$", "`$")
	p = strings.ReplaceAll(p, `"`, "`\"")
	return `"` + p + `"`
}
