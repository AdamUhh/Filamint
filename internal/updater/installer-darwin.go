package updater

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

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
		exec.Command("hdiutil", "detach", mountPoint, "-quiet").Run()
		os.Remove(path)
	}()

	appName, err := findAppBundle(mountPoint)
	if err != nil {
		slog.Error("no .app found in dmg", "mount_point", mountPoint)
		return err
	}

	src := filepath.Join(mountPoint, appName)
	dst := filepath.Join("/Applications", appName)

	os.RemoveAll(dst)
	if out, err := exec.Command("cp", "-R", src, dst).CombinedOutput(); err != nil {
		slog.Error("failed to copy app to /Applications", "src", src, "dst", dst, "output", string(out), "error", err)
		return fmt.Errorf("copying app to /Applications: %w (output: %s)", err, out)
	}
	slog.Info("app installed", "path", dst)

	exec.Command("hdiutil", "detach", mountPoint, "-quiet").Run()
	os.Remove(path)

	if err := exec.Command("open", dst).Start(); err != nil {
		slog.Error("failed to relaunch app", "path", dst, "error", err)
		return fmt.Errorf("relaunching app: %w", err)
	}
	return nil
}

// Helpers

// Extracts the mount point from hdiutil output
func parseDMGMountPoint(out string) (string, error) {
	var mountPoint string
	for line := range strings.SplitSeq(strings.TrimSpace(out), "\n") {
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

// Returns the first .app entry inside a mounted DMG volume
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
