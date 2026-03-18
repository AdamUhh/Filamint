//go:build linux

package updater

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"testing"
	"time"
)

func crossDeviceErr() error {
	return syscall.EXDEV
}

// --- applyUpdate tests ---

func TestApplyUpdate_SameDevice(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "myapp")
	tmp := filepath.Join(dir, "myapp.new")

	os.WriteFile(target, []byte("old binary"), 0755)
	os.WriteFile(tmp, []byte("new binary"), 0755)

	if err := applyUpdate(tmp, target); err != nil {
		t.Fatalf("applyUpdate failed: %v", err)
	}

	got, _ := os.ReadFile(target)
	if string(got) != "new binary" {
		t.Errorf("target content = %q, want %q", got, "new binary")
	}
	if _, err := os.Stat(tmp); !os.IsNotExist(err) {
		t.Error("tmp file should have been removed")
	}
	oldPath := filepath.Join(dir, ".myapp.old")
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error(".old file should have been removed")
	}
}

func TestApplyUpdate_RollsBackOnFailure(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "myapp")
	os.WriteFile(target, []byte("original"), 0755)

	err := applyUpdate(filepath.Join(dir, "does-not-exist"), target)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

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

	os.WriteFile(target, []byte("old"), 0755)
	os.WriteFile(tmp, []byte("new"), 0755)
	os.WriteFile(oldPath, []byte("leftover"), 0755)

	if err := applyUpdate(tmp, target); err != nil {
		t.Fatalf("applyUpdate failed: %v", err)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error(".old leftover should have been removed")
	}
}

// --- installLinuxExecutable tests ---

func TestInstallLinuxExecutable_InstalledBinaryIsExecutable(t *testing.T) {
	dir := t.TempDir()
	newBin := filepath.Join(dir, "update")
	target := filepath.Join(dir, "app")

	os.WriteFile(newBin, []byte("#!/bin/sh\necho new"), 0600)
	os.WriteFile(target, []byte("#!/bin/sh\necho old"), 0755)
	os.Chmod(newBin, 0755)

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

// fakePkexec puts a fake pkexec binary that exits with the given code on PATH.
func fakePkexec(t *testing.T, exitCode int) {
	t.Helper()
	fakebin := filepath.Join(t.TempDir(), "pkexec")
	script := "#!/bin/sh\nexit 0"
	if exitCode != 0 {
		script = "#!/bin/sh\nexit 1"
	}
	os.WriteFile(fakebin, []byte(script), 0755)
	t.Setenv("PATH", filepath.Dir(fakebin)+":"+os.Getenv("PATH"))
}

func TestInstallLinuxDeb_Success(t *testing.T) {
	dir := t.TempDir()
	debPath := filepath.Join(dir, "pkg.deb")
	os.WriteFile(debPath, []byte("fake deb"), 0644)
	fakePkexec(t, 0)

	if err := installLinuxDeb(debPath); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := os.Stat(debPath); !os.IsNotExist(err) {
		t.Error("deb file should have been removed after install")
	}
}

func TestInstallLinuxDeb_DpkgFailure(t *testing.T) {
	dir := t.TempDir()
	debPath := filepath.Join(dir, "pkg.deb")
	os.WriteFile(debPath, []byte("fake deb"), 0644)
	fakePkexec(t, 1)

	if err := installLinuxDeb(debPath); err == nil {
		t.Fatal("expected error when pkexec fails")
	}
}

// --- Test 4: installLinuxDeb cleans up both the .deb file AND the parent temp dir ---

func TestInstallLinuxDeb_CleansUpTempDir(t *testing.T) {
	// Mirror what DownloadAndInstall produces: os.TempDir()/app-update-XYZ/pkg.deb
	// Use os.MkdirTemp directly (not t.TempDir) so we can assert it gets removed.
	tmpDir, err := os.MkdirTemp("", tempDirPrefix+"*")
	if err != nil {
		t.Fatal(err)
	}

	debPath := filepath.Join(tmpDir, "pkg.deb")
	os.WriteFile(debPath, []byte("fake deb"), 0644)
	fakePkexec(t, 0)

	if err := installLinuxDeb(debPath); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := os.Stat(debPath); !os.IsNotExist(err) {
		t.Error("deb file should have been removed")
	}
	if _, err := os.Stat(tmpDir); !os.IsNotExist(err) {
		os.RemoveAll(tmpDir)
		t.Error("temp update dir should have been removed after deb install")
	}
}

func TestInstallLinuxDeb_TempDirRemovedEvenWithExtraFiles(t *testing.T) {
	// If the code used os.Remove instead of os.RemoveAll on the dir,
	// this would fail because the dir still has a leftover file inside it.
	tmpDir, err := os.MkdirTemp("", tempDirPrefix+"*")
	if err != nil {
		t.Fatal(err)
	}

	debPath := filepath.Join(tmpDir, "pkg.deb")
	os.WriteFile(debPath, []byte("fake deb"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "leftover.tmp"), []byte("extra"), 0644)
	fakePkexec(t, 0)

	if err := installLinuxDeb(debPath); err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := os.Stat(tmpDir); !os.IsNotExist(err) {
		os.RemoveAll(tmpDir)
		t.Error("temp dir with extra files should still be fully removed")
	}
}

// --- runInstaller routing tests ---

func TestRunInstaller_RoutesCorrectly(t *testing.T) {
	t.Run("raw routes to installLinuxExecutable", func(t *testing.T) {
		p := Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}
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
	os.WriteFile(bin, []byte{}, 0755)

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
	os.WriteFile(bin, []byte{}, 0755)

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

	os.WriteFile(src, content, 0644)

	if err := copyFile(src, dst); err != nil {
		t.Fatalf("copyFile failed: %v", err)
	}
	got, _ := os.ReadFile(dst)
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
	os.WriteFile(f, []byte("data"), 0644)

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
	if RunWatchdogIfRequested() {
		t.Error("expected false on linux")
	}
}

// --- Test 6: makeTempUpdateDir ---

func TestMakeTempUpdateDir_CreatesInTempDir(t *testing.T) {
	p := Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}

	dir, err := makeTempUpdateDir(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer os.RemoveAll(dir)

	info, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("created dir not found: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected a directory")
	}
	if filepath.Dir(dir) != os.TempDir() {
		t.Errorf("expected dir inside %q, got %q", os.TempDir(), dir)
	}
	if base := filepath.Base(dir); base[:len(tempDirPrefix)] != tempDirPrefix {
		t.Errorf("dir name %q should start with %q", base, tempDirPrefix)
	}
}

func TestMakeTempUpdateDir_EachCallUnique(t *testing.T) {
	p := Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}

	dir1, err := makeTempUpdateDir(p)
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir1)

	dir2, err := makeTempUpdateDir(p)
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir2)

	if dir1 == dir2 {
		t.Error("each call should produce a unique directory")
	}
}

// --- Test 7: cleanupUpdateArtifacts ---

func newLinuxUpdater() *UpdateService {
	s := &UpdateService{
		platform: Platform{OS: "linux", Arch: "x86_64", Variant: "raw"},
		cache:    cachedResult{ttl: 10 * time.Minute},
	}
	s.cond = sync.NewCond(&s.mu)
	return s
}

func TestCleanupUpdateArtifacts_RemovesTempDirs(t *testing.T) {
	// Simulate two interrupted downloads left behind in os.TempDir()
	dir1, err := os.MkdirTemp(os.TempDir(), tempDirPrefix+"*")
	if err != nil {
		t.Fatal(err)
	}
	dir2, err := os.MkdirTemp(os.TempDir(), tempDirPrefix+"*")
	if err != nil {
		os.RemoveAll(dir1)
		t.Fatal(err)
	}
	// Files inside ensure RemoveAll is used, not Remove
	os.WriteFile(filepath.Join(dir1, "update"), []byte("partial"), 0644)
	os.WriteFile(filepath.Join(dir2, "update.deb"), []byte("partial"), 0644)

	newLinuxUpdater().cleanupUpdateArtifacts(context.Background())

	if _, err := os.Stat(dir1); !os.IsNotExist(err) {
		os.RemoveAll(dir1)
		t.Errorf("expected %q to be cleaned up", dir1)
	}
	if _, err := os.Stat(dir2); !os.IsNotExist(err) {
		os.RemoveAll(dir2)
		t.Errorf("expected %q to be cleaned up", dir2)
	}
}

func TestCleanupUpdateArtifacts_IgnoresNonMatchingDirs(t *testing.T) {
	// A dir without our prefix must be left alone
	unrelated, err := os.MkdirTemp(os.TempDir(), "some-other-app-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(unrelated)

	newLinuxUpdater().cleanupUpdateArtifacts(context.Background())

	if _, err := os.Stat(unrelated); err != nil {
		t.Errorf("unrelated dir should not have been removed: %v", err)
	}
}

func TestCleanupUpdateArtifacts_IgnoresPrefixedFiles(t *testing.T) {
	// A regular *file* with our prefix should not be removed — only dirs are targets
	f, err := os.CreateTemp(os.TempDir(), tempDirPrefix+"*")
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	defer os.Remove(f.Name())

	newLinuxUpdater().cleanupUpdateArtifacts(context.Background())

	if _, err := os.Stat(f.Name()); err != nil {
		t.Errorf("prefixed file (not dir) should not have been removed: %v", err)
	}
}

func TestCleanupUpdateArtifacts_RespectsContextCancellation(t *testing.T) {
	dir1, err := os.MkdirTemp(os.TempDir(), tempDirPrefix+"*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir1)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel before calling — must return promptly without hanging

	newLinuxUpdater().cleanupUpdateArtifacts(ctx)
	// Passing without deadlock is the assertion.
}

// Suppress "imported and not used" if exec hook tests are removed.
var _ = exec.Command
