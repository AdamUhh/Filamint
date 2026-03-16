package updater

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strings"
)

func installLinuxExecutable(tmpPath string) error {
	if err := os.Chmod(tmpPath, 0755); err != nil {
		slog.Error("failed to chmod update binary", "path", tmpPath, "error", err)
		return fmt.Errorf("chmod binary: %w", err)
	}

	self, err := resolveExecutable()
	if err != nil {
		return err
	}

	script := buildLinuxUpdateScript(os.Getpid(), tmpPath, self)
	if err := launchShellScript(script); err != nil {
		slog.Error("failed to start linux update script", "error", err)
		return fmt.Errorf("starting linux update script: %w", err)
	}
	return nil
}

func installLinuxDeb(tmpPath string) error {
	self, err := resolveExecutable()
	if err != nil {
		return err
	}

	cmd := exec.Command("pkexec", "dpkg", "-i", tmpPath)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		slog.Error("dpkg install failed", "path", tmpPath, "error", err)
		return fmt.Errorf("dpkg install: %w", err)
	}
	os.Remove(tmpPath)

	if err := exec.Command(self).Start(); err != nil {
		slog.Error("failed to relaunch after deb install", "path", self, "error", err)
		return fmt.Errorf("relaunching after deb install: %w", err)
	}
	return nil
}

// Helpers

// Returns a shell script that waits for pid to exit, replaces self with tmpPath, then relaunches self
func buildLinuxUpdateScript(pid int, tmpPath, self string) string {
	qTmp := singleQuote(tmpPath)
	qSelf := singleQuote(self)
	return fmt.Sprintf(`#!/bin/sh
while kill -0 %d 2>/dev/null; do sleep 0.2; done
if cp %s %s; then
    chmod +x %s
    rm -- %s
    %s &
else
    echo "update cp failed" >&2
fi
rm -- "$0"
`, pid, qTmp, qSelf, qSelf, qTmp, qSelf)
}

func launchShellScript(script string) error {
	f, err := os.CreateTemp("", "app-update-*.sh")
	if err != nil {
		slog.Error("failed to create update script", "error", err)
		return fmt.Errorf("creating script: %w", err)
	}
	if _, err := f.WriteString(script); err != nil {
		f.Close()
		os.Remove(f.Name())
		slog.Error("failed to write update script", "error", err)
		return fmt.Errorf("writing script: %w", err)
	}
	f.Close()
	if err := os.Chmod(f.Name(), 0755); err != nil {
		os.Remove(f.Name())
		slog.Error("failed to chmod update script", "path", f.Name(), "error", err)
		return fmt.Errorf("chmod script: %w", err)
	}
	if err := exec.Command("/bin/sh", f.Name()).Start(); err != nil {
		os.Remove(f.Name())
		slog.Error("failed to start update script", "path", f.Name(), "error", err)
		return err
	}
	return nil
}

// Wraps s in POSIX single quotes, escaping any embedded single quotes
func singleQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
