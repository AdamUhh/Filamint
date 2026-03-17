package updater

import (
	"fmt"
	"log/slog"
	"runtime"
)

// Build-time vars set via -ldflags.
var buildType = "portable" // "portable" | "installer"  (Windows only)
var linuxPackage = "raw"   // "raw" | "deb"             (Linux only)

// Captures the OS, architecture, and install-mode for the running binary.
// Keeping it as a value rather than reading globals at call-time
// means tests can construct any platform without touching package-level state.
type Platform struct {
	OS      string // "windows" | "darwin" | "linux"
	Arch    string // "x86_64" | "aarch64" | ...
	Variant string // "portable" | "installer" | "deb" | "" (raw binary)
}

// Reads runtime.GOOS/GOARCH and the link-time vars to build the Platform for the current process.
func DetectPlatform() Platform {
	slog.Info("BuildType", "type", buildType)
	return Platform{
		OS:      runtime.GOOS,
		Arch:    normaliseArch(runtime.GOARCH),
		Variant: detectVariant(runtime.GOOS),
	}
}

// Returns the key that must exist in latest.json for this platform.
// Keys must match what release.yml writes:
//
//	windows-x86_64-installer
//	windows-x86_64-portable
//	darwin-aarch64
//	darwin-x86_64
//	linux-x86_64          (raw binary)
//	linux-x86_64-deb
func (p Platform) ManifestKey() (string, error) {
	switch p.OS {
	case "windows":
		return "windows-" + p.Arch + "-" + p.Variant, nil
	case "darwin":
		return "darwin-" + p.Arch, nil
	case "linux":
		if p.Variant == "deb" {
			return "linux-" + p.Arch + "-deb", nil
		}
		return "linux-" + p.Arch, nil
	default:
		return "", fmt.Errorf("unsupported platform: %s/%s", p.OS, p.Arch)
	}
}

// Reports whether this is a portable (non-installer) Windows build
func (p Platform) IsPortableWindows() bool {
	return p.OS == "windows" && p.Variant == "portable"
}

// Reports whether this is a binary linux build
func (p Platform) IsBinaryLinux() bool {
	return p.OS == "linux" && p.Variant == "raw"
}

// Helpers
func normaliseArch(goarch string) string {
	switch goarch {
	case "amd64":
		return "x86_64"
	case "arm64":
		return "aarch64"
	default:
		return goarch
	}
}

func detectVariant(goos string) string {
	switch goos {
	case "windows":
		if buildType == "portable" {
			return "portable"
		}
		return "installer"
	case "linux":
		if linuxPackage == "deb" {
			return "deb"
		}
		return "raw"
	default:
		return ""
	}
}
