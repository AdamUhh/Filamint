//go:build windows

package updater

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

// restartApp spawns a detached watchdog (ourselves with a special flag) that
// waits for this process to exit, then takes over:
//   - installer variant: launches the NSIS installer with UAC elevation.
//     NSIS handles relaunching the app via its "Launch app" finish-page checkbox.
//   - portable variant: applyUpdate has already replaced the binary in-place,
//     so the watchdog just relaunches the new binary directly.
func restartApp(installerPath string) error {
	p := DetectPlatform()

	self, err := resolveExecutable()
	if err != nil {
		return fmt.Errorf("resolving executable: %w", err)
	}

	pid := os.Getpid()
	slog.Info("spawning restart watchdog", "pid", pid, "path", self, "variant", p.Variant)

	watchdogArgs := []string{
		"--updater-watchdog-restart",
		strconv.Itoa(pid),
		p.Variant,
		installerPath, // empty string for portable
	}

	// For portable, forward app args so the relaunched binary gets them.
	// For installer, NSIS handles the relaunch — no need to forward args.
	if p.Variant == "portable" {
		watchdogArgs = append(watchdogArgs, os.Args[1:]...)
	}

	cmd := exec.Command(self, watchdogArgs...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil
	cmd.SysProcAttr = detachedProcAttr()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting watchdog process: %w", err)
	}

	// Give the watchdog time to call OpenProcess before we exit and release our handle.
	time.Sleep(500 * time.Millisecond)
	os.Exit(0)
	return nil // unreachable
}

// RunWatchdogIfRequested checks os.Args for the watchdog flag injected by
// restartApp. Call this at the very top of main(), before any other init.
// Returns true if we are the watchdog (caller should exit after this returns).
func RunWatchdogIfRequested() bool {
	args := os.Args
	if len(args) < 5 || args[1] != "--updater-watchdog-restart" {
		return false
	}

	parentPID, err := strconv.Atoi(args[2])
	if err != nil {
		slog.Error("watchdog: invalid parent PID", "arg", args[2])
		return true
	}
	variant := args[3]
	installerPath := args[4]

	logPath := filepath.Join(os.TempDir(), "filamint-watchdog.log")
	if logFile, logErr := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600); logErr == nil {
		slog.SetDefault(slog.New(slog.NewTextHandler(logFile, nil)))
		defer logFile.Close()
	}

	slog.Info("watchdog: waiting for parent to exit", "parentPID", parentPID, "variant", variant)
	waitForPID(parentPID)

	switch variant {
	case "installer":
		// Launch the NSIS installer with elevation. The UAC prompt will appear,
		// and NSIS's finish-page checkbox handles relaunching the app.
		slog.Info("watchdog: launching NSIS installer", "path", installerPath)
		script := fmt.Sprintf(`Start-Process -FilePath '%s' -Verb RunAs`, installerPath)
		cmd := exec.Command("powershell", "-NoProfile", "-Command", script)
		cmd.Stdout = nil
		cmd.Stderr = nil
		cmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: windows.CREATE_NO_WINDOW,
		}
		if err := cmd.Run(); err != nil {
			slog.Error("watchdog: NSIS installer failed", "error", err)
		}

	case "portable":
		// Binary was already replaced in-place by applyUpdate. Just relaunch it.
		launchPath, err := resolveExecutable()
		if err != nil {
			slog.Error("watchdog: could not resolve executable", "error", err)
			return true
		}

		forwardedArgs := args[5:]
		for _, a := range forwardedArgs {
			if a == "--updater-watchdog-restart" {
				slog.Error("watchdog: forwarded args contain watchdog flag — dropping all forwarded args")
				forwardedArgs = nil
				break
			}
		}

		slog.Info("watchdog: launching updated binary", "path", launchPath, "args", forwardedArgs)
		cmd := exec.Command(launchPath, forwardedArgs...)
		cmd.Stdout = nil
		cmd.Stderr = nil
		cmd.Stdin = nil
		if err := cmd.Start(); err != nil {
			slog.Error("watchdog: failed to launch updated binary", "error", err)
		}

	default:
		slog.Error("watchdog: unknown variant", "variant", variant)
	}

	return true
}

// waitForPID blocks until the process with the given PID exits.
func waitForPID(pid int) {
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		slog.Warn("watchdog: could not open parent process, assuming already exited", "error", err)
		return
	}
	defer windows.CloseHandle(handle)

	result, _ := windows.WaitForSingleObject(handle, 30_000)
	if result != windows.WAIT_OBJECT_0 {
		slog.Warn("watchdog: parent did not exit cleanly in time", "result", result)
	}
}

// detachedProcAttr creates the child in a new process group, fully detached
// from the current console session.
func detachedProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		CreationFlags: windows.CREATE_NEW_PROCESS_GROUP | windows.DETACHED_PROCESS | windows.CREATE_NO_WINDOW,
	}
}

// --- installer logic ---

func runInstaller(key, tmpPath string, p Platform) (string, error) {
	switch p.Variant {
	case "portable":
		slog.Info("windows portable install", "key", key)
		return "", installWindowsPortable(tmpPath)
	case "installer":
		slog.Info("windows installer install", "key", key)
		return installWindows(tmpPath)
	default:
		return "", fmt.Errorf("unsupported windows variant: %s", p.Variant)
	}
}

// installWindows renames the downloaded file to .exe and returns its path.
// The caller stores this path and passes it to restartApp.
func installWindows(path string) (string, error) {
	exePath := path + ".exe"
	if err := os.Rename(path, exePath); err != nil {
		return "", fmt.Errorf("renaming installer: %w", err)
	}
	slog.Info("installer staged, waiting for user restart", "path", exePath)
	return exePath, nil
}

func installWindowsPortable(tmpPath string) error {
	self, err := resolveExecutable()
	if err != nil {
		return err
	}
	return applyUpdate(tmpPath, self)
}

// applyUpdate: sync → rename target→.old → rename tmp→target → hide .old
func applyUpdate(tmpPath, target string) error {
	if err := syncFile(tmpPath); err != nil {
		return fmt.Errorf("syncing update file: %w", err)
	}

	dir := filepath.Dir(target)
	base := filepath.Base(target)
	oldPath := filepath.Join(dir, "."+base+".old")

	_ = os.Remove(oldPath) // clear any leftover from a previous update

	if err := os.Rename(target, oldPath); err != nil {
		return fmt.Errorf("moving target to .old: %w", err)
	}

	if err := os.Rename(tmpPath, target); err != nil {
		if isErrCrossDevice(err) {
			// Temp dir is on a different drive — fall back to copy+sync.
			slog.Warn("cross-device rename, falling back to copy", "src", tmpPath, "dst", target)
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

	// .old is still locked by the running process; hide it for cleanup on next launch.
	if err := os.Remove(oldPath); err != nil {
		_ = hideFile(oldPath)
	}

	slog.Info("update applied, waiting for user restart")
	return nil
}

// isErrCrossDevice detects ERROR_NOT_SAME_DEVICE (win32: 0x11 / errno: EXDEV).
func isErrCrossDevice(err error) bool {
	if le, ok := err.(*os.LinkError); ok {
		if errno, ok := le.Err.(syscall.Errno); ok {
			return errno == 0x11
		}
	}
	return false
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	tmp := dst + ".tmp"
	out, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp) }() // no-op if rename succeeds

	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return fmt.Errorf("copying data: %w", err)
	}
	if err := out.Sync(); err != nil {
		out.Close()
		return fmt.Errorf("syncing copy: %w", err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("closing copy: %w", err)
	}
	return os.Rename(tmp, dst)
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
	return windows.SetFileAttributes(ptr, attrs|windows.FILE_ATTRIBUTE_HIDDEN)
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
