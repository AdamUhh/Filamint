//go:build linux

package updater

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// --- applyUpdate tests ---

func TestApplyUpdate_SameDevice(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "myapp")
	tmp := filepath.Join(dir, "myapp.new")

	if err := os.WriteFile(target, []byte("old binary"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(tmp, []byte("new binary"), 0755); err != nil {
		t.Fatal(err)
	}

	if err := applyUpdate(tmp, target); err != nil {
		t.Fatalf("applyUpdate failed: %v", err)
	}

	got, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("reading target: %v", err)
	}
	if string(got) != "new binary" {
		t.Errorf("target content = %q, want %q", got, "new binary")
	}

	// tmp should be gone
	if _, err := os.Stat(tmp); !os.IsNotExist(err) {
		t.Error("tmp file should have been removed")
	}

	// .old should be cleaned up
	oldPath := filepath.Join(dir, ".myapp.old")
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error(".old file should have been removed")
	}
}

func TestApplyUpdate_RollsBackOnFailure(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "myapp")

	// Write original binary
	if err := os.WriteFile(target, []byte("original"), 0755); err != nil {
		t.Fatal(err)
	}

	// Point tmpPath at a nonexistent file to force the rename to fail after
	// the target has been moved to .old
	tmp := filepath.Join(dir, "does-not-exist")

	err := applyUpdate(tmp, target)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	// Target should be restored
	got, readErr := os.ReadFile(target)
	if readErr != nil {
		t.Fatalf("target missing after rollback: %v", readErr)
	}
	if string(got) != "original" {
		t.Errorf("target after rollback = %q, want %q", got, "original")
	}
}

func TestApplyUpdate_PreexistingOldFileIsRemoved(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "myapp")
	tmp := filepath.Join(dir, "myapp.new")
	oldPath := filepath.Join(dir, ".myapp.old")

	if err := os.WriteFile(target, []byte("old"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(tmp, []byte("new"), 0755); err != nil {
		t.Fatal(err)
	}
	// Simulate a leftover .old from a previous update
	if err := os.WriteFile(oldPath, []byte("leftover"), 0755); err != nil {
		t.Fatal(err)
	}

	if err := applyUpdate(tmp, target); err != nil {
		t.Fatalf("applyUpdate failed: %v", err)
	}

	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error(".old leftover should have been removed")
	}
}

// --- installLinuxExecutable tests ---

func TestInstallLinuxExecutable_ChmodAndReplace(t *testing.T) {
	dir := t.TempDir()

	// Create a fake "current binary" - resolveExecutable() reads the real binary,
	// so we test the chmod + applyUpdate path directly via a temp file acting as target.
	newBin := filepath.Join(dir, "update")
	if err := os.WriteFile(newBin, []byte("#!/bin/sh\necho new"), 0600); err != nil {
		t.Fatal(err)
	}

	target := filepath.Join(dir, "app")
	if err := os.WriteFile(target, []byte("#!/bin/sh\necho old"), 0755); err != nil {
		t.Fatal(err)
	}

	// chmod the tmp file and apply
	if err := os.Chmod(newBin, 0755); err != nil {
		t.Fatal(err)
	}
	if err := applyUpdate(newBin, target); err != nil {
		t.Fatalf("applyUpdate failed: %v", err)
	}

	info, err := os.Stat(target)
	if err != nil {
		t.Fatalf("target missing: %v", err)
	}
	if info.Mode()&0111 == 0 {
		t.Error("installed binary should be executable")
	}
}

// --- installLinuxDeb tests ---

func TestInstallLinuxDeb_Success(t *testing.T) {
	dir := t.TempDir()
	debPath := filepath.Join(dir, "pkg.deb")
	os.WriteFile(debPath, []byte("fake deb"), 0644)

	// Put a fake "pkexec" on PATH that just exits 0
	fakebin := filepath.Join(dir, "pkexec")
	os.WriteFile(fakebin, []byte("#!/bin/sh\nexit 0"), 0755)
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	err := installLinuxDeb(debPath)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := os.Stat(debPath); !os.IsNotExist(err) {
		t.Error("deb file should have been cleaned up")
	}
}

func TestInstallLinuxDeb_DpkgFailure(t *testing.T) {
	dir := t.TempDir()
	debPath := filepath.Join(dir, "pkg.deb")
	os.WriteFile(debPath, []byte("fake deb"), 0644)

	// Fake pkexec that exits 1
	fakebin := filepath.Join(dir, "pkexec")
	os.WriteFile(fakebin, []byte("#!/bin/sh\nexit 1"), 0755)
	t.Setenv("PATH", dir+":"+os.Getenv("PATH"))

	err := installLinuxDeb(debPath)
	if err == nil {
		t.Fatal("expected error when pkexec fails")
	}
}

// --- runInstaller routing tests ---

func TestRunInstaller_RoutesCorrectly(t *testing.T) {
	t.Run("raw routes to installLinuxExecutable path", func(t *testing.T) {
		p := Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}
		// Pass a nonexistent tmpPath - we just want to confirm routing reaches
		// installLinuxExecutable, which will fail on chmod but NOT on routing.
		_, err := runInstaller("linux-x86_64", "/nonexistent/path", p)
		if err == nil {
			t.Error("expected error (chmod on nonexistent path), got nil")
		}
	})

	t.Run("unsupported variant returns error", func(t *testing.T) {
		p := Platform{OS: "linux", Arch: "x86_64", Variant: "rpm"}
		_, err := runInstaller("linux-x86_64-rpm", "/tmp/pkg.rpm", p)
		if err == nil {
			t.Fatal("expected error for unsupported variant")
		}
	})
}

// --- executableFromArgs tests ---

func TestExecutableFromArgs_AbsolutePath(t *testing.T) {
	dir := t.TempDir()
	bin := filepath.Join(dir, "myapp")
	if err := os.WriteFile(bin, []byte{}, 0755); err != nil {
		t.Fatal(err)
	}

	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{bin}

	got, err := executableFromArgs()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != bin {
		t.Errorf("got %q, want %q", got, bin)
	}
}

func TestExecutableFromArgs_RelativePath(t *testing.T) {
	dir := t.TempDir()
	bin := filepath.Join(dir, "myapp")
	if err := os.WriteFile(bin, []byte{}, 0755); err != nil {
		t.Fatal(err)
	}

	origArgs := os.Args
	origWd, _ := os.Getwd()
	defer func() {
		os.Args = origArgs
		os.Chdir(origWd)
	}()

	os.Chdir(dir)
	os.Args = []string{"./myapp"}

	got, err := executableFromArgs()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != bin {
		t.Errorf("got %q, want %q", got, bin)
	}
}

// --- isCrossDevice tests ---

func crossDeviceErr() error {
	return syscall.EXDEV
}

func TestIsCrossDevice(t *testing.T) {
	linkErr := &os.LinkError{Err: crossDeviceErr()}
	if !isCrossDevice(linkErr) {
		t.Error("expected isCrossDevice=true for EXDEV LinkError")
	}

	if isCrossDevice(os.ErrNotExist) {
		t.Error("expected isCrossDevice=false for unrelated error")
	}
}

// --- copyFile tests ---

func TestCopyFile(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "src")
	dst := filepath.Join(dir, "dst")

	content := []byte("hello updater")
	if err := os.WriteFile(src, content, 0644); err != nil {
		t.Fatal(err)
	}

	if err := copyFile(src, dst); err != nil {
		t.Fatalf("copyFile failed: %v", err)
	}

	got, err := os.ReadFile(dst)
	if err != nil {
		t.Fatalf("reading dst: %v", err)
	}
	if string(got) != string(content) {
		t.Errorf("dst content = %q, want %q", got, content)
	}
}

func TestCopyFile_MissingSrc(t *testing.T) {
	dir := t.TempDir()
	if err := copyFile("/nonexistent/src", filepath.Join(dir, "dst")); err == nil {
		t.Fatal("expected error for missing src")
	}
}

// --- syncFile tests ---

func TestSyncFile(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "data")
	if err := os.WriteFile(f, []byte("data"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := syncFile(f); err != nil {
		t.Fatalf("syncFile failed: %v", err)
	}
}

func TestSyncFile_MissingFile(t *testing.T) {
	if err := syncFile("/nonexistent/file"); err == nil {
		t.Fatal("expected error for missing file")
	}
}

// --- RunWatchdogIfRequested ---

func TestRunWatchdogIfRequested_ReturnsFalse(t *testing.T) {
	// Linux always returns false - no watchdog needed
	if RunWatchdogIfRequested() {
		t.Error("expected false on linux")
	}
}
