package updater

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// mockHTTPClient is a thread-safe fake that replaces the real *http.Client.
type mockHTTPClient struct {
	mu       sync.Mutex
	calls    int
	response func(attempt int) (*http.Response, error)
}

func (m *mockHTTPClient) Get(_ string) (*http.Response, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	return m.response(m.calls)
}

func (m *mockHTTPClient) Calls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.calls
}

// jsonResponse wraps a JSON string in an *http.Response with status 200.
func jsonResponse(body string) *http.Response {
	return &http.Response{
		StatusCode:    http.StatusOK,
		ContentLength: int64(len(body)),
		Body:          io.NopCloser(strings.NewReader(body)),
	}
}

// manifestJSON builds a valid manifest JSON for a given version and platform key.
func manifestJSON(version, platformKey, downloadURL string) string {
	return `{
		"version":  "` + version + `",
		"notes":    "release notes for ` + version + `",
		"pub_date": "2025-06-01T00:00:00Z",
		"platforms": {
			"` + platformKey + `": {"url": "` + downloadURL + `"}
		}
	}`
}

// newTestService builds an UpdateService suitable for unit tests,
// bypassing DetectPlatform() so tests are not OS-dependent.
func newTestService(client HTTPClient, currentVersion string, platform Platform) *UpdateService {
	s := &UpdateService{
		currentVersion: currentVersion,
		manifestURL:    "https://fake.invalid/latest.json",
		client:         client,
		platform:       platform,
		cache:          cachedResult{ttl: 10 * time.Minute},
	}
	s.cond = sync.NewCond(&s.mu)
	return s
}

// Canonical test platforms — one per OS.
var (
	platDarwin  = Platform{OS: "darwin", Arch: "aarch64"}
	platWindows = Platform{OS: "windows", Arch: "x86_64", Variant: "portable"}
	platLinux   = Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}
)

// staticClient returns the same successful response on every call.
func staticClient(body string) *mockHTTPClient {
	return &mockHTTPClient{
		response: func(_ int) (*http.Response, error) { return jsonResponse(body), nil },
	}
}

// errorClient always returns the given error.
func errorClient(err error) *mockHTTPClient {
	return &mockHTTPClient{
		response: func(_ int) (*http.Response, error) { return nil, err },
	}
}

// ---------------------------------------------------------------------------
// CheckForUpdate – update available (one per OS)
// ---------------------------------------------------------------------------

func TestCheckForUpdate_UpdateAvailable_Darwin(t *testing.T) {
	mock := staticClient(manifestJSON("2.0.0", "darwin-aarch64", "https://dl.example.com/app-2.0.0.dmg"))
	svc := newTestService(mock, "1.0.0", platDarwin)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Available {
		t.Error("expected Available=true for 2.0.0 > 1.0.0")
	}
	if info.DownloadURL != "https://dl.example.com/app-2.0.0.dmg" {
		t.Errorf("DownloadURL: got %q", info.DownloadURL)
	}
	if info.NewVersion != "2.0.0" {
		t.Errorf("NewVersion: got %q, want 2.0.0", info.NewVersion)
	}
	if info.CurrentVersion != "1.0.0" {
		t.Errorf("CurrentVersion: got %q, want 1.0.0", info.CurrentVersion)
	}
}

func TestCheckForUpdate_UpdateAvailable_Windows(t *testing.T) {
	mock := staticClient(manifestJSON("2.0.0", "windows-x86_64-portable", "https://dl.example.com/app-2.0.0.exe"))
	svc := newTestService(mock, "1.0.0", platWindows)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Available {
		t.Error("expected Available=true for 2.0.0 > 1.0.0")
	}
	if info.DownloadURL != "https://dl.example.com/app-2.0.0.exe" {
		t.Errorf("DownloadURL: got %q", info.DownloadURL)
	}
}

func TestCheckForUpdate_UpdateAvailable_Linux(t *testing.T) {
	mock := staticClient(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app-2.0.0"))
	svc := newTestService(mock, "1.0.0", platLinux)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Available {
		t.Error("expected Available=true for 2.0.0 > 1.0.0")
	}
	if info.DownloadURL != "https://dl.example.com/app-2.0.0" {
		t.Errorf("DownloadURL: got %q", info.DownloadURL)
	}
}

// ---------------------------------------------------------------------------
// CheckForUpdate – no update (equal versions, one per OS)
// ---------------------------------------------------------------------------

func TestCheckForUpdate_NoUpdateWhenVersionsEqual_Darwin(t *testing.T) {
	mock := staticClient(manifestJSON("1.5.0", "darwin-aarch64", "https://dl.example.com/app.dmg"))
	svc := newTestService(mock, "1.5.0", platDarwin)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected Available=false when versions are equal")
	}
	if info.DownloadURL != "" {
		t.Errorf("expected empty DownloadURL when no update, got %q", info.DownloadURL)
	}
}

func TestCheckForUpdate_NoUpdateWhenVersionsEqual_Windows(t *testing.T) {
	mock := staticClient(manifestJSON("1.5.0", "windows-x86_64-portable", "https://dl.example.com/app.exe"))
	svc := newTestService(mock, "1.5.0", platWindows)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected Available=false when versions are equal")
	}
}

func TestCheckForUpdate_NoUpdateWhenVersionsEqual_Linux(t *testing.T) {
	mock := staticClient(manifestJSON("1.5.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "1.5.0", platLinux)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected Available=false when versions are equal")
	}
}

// ---------------------------------------------------------------------------
// CheckForUpdate – no update (current ahead of manifest, one per OS)
// ---------------------------------------------------------------------------

func TestCheckForUpdate_NoUpdateWhenAhead_Darwin(t *testing.T) {
	mock := staticClient(manifestJSON("1.0.0", "darwin-aarch64", "https://dl.example.com/app.dmg"))
	svc := newTestService(mock, "2.0.0", platDarwin)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected Available=false when current > manifest")
	}
}

func TestCheckForUpdate_NoUpdateWhenAhead_Windows(t *testing.T) {
	mock := staticClient(manifestJSON("1.0.0", "windows-x86_64-portable", "https://dl.example.com/app.exe"))
	svc := newTestService(mock, "2.0.0", platWindows)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected Available=false when current > manifest")
	}
}

func TestCheckForUpdate_NoUpdateWhenAhead_Linux(t *testing.T) {
	mock := staticClient(manifestJSON("1.0.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "2.0.0", platLinux)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected Available=false when current > manifest")
	}
}

// ---------------------------------------------------------------------------
// CheckForUpdate – semver edge cases
// ---------------------------------------------------------------------------

func TestCheckForUpdate_PatchVersionUpdate_Linux(t *testing.T) {
	mock := staticClient(manifestJSON("1.0.1", "linux-x86_64", "https://dl.example.com/app-1.0.1"))
	svc := newTestService(mock, "1.0.0", platLinux)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Available {
		t.Error("expected Available=true for patch bump 1.0.0 -> 1.0.1")
	}
}

func TestCheckForUpdate_MinorVersionUpdate_Darwin(t *testing.T) {
	mock := staticClient(manifestJSON("1.1.0", "darwin-aarch64", "https://dl.example.com/app-1.1.0.dmg"))
	svc := newTestService(mock, "1.0.0", platDarwin)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Available {
		t.Error("expected Available=true for minor bump 1.0.0 -> 1.1.0")
	}
}

func TestCheckForUpdate_PreReleaseNotConsideredNewer_Windows(t *testing.T) {
	// semver: 2.0.0-beta.1 < 2.0.0, so a pre-release manifest must not
	// trigger an update when the current build is the stable release.
	mock := staticClient(manifestJSON("2.0.0-beta.1", "windows-x86_64-portable", "https://dl.example.com/app-beta.exe"))
	svc := newTestService(mock, "2.0.0", platWindows)

	info, err := svc.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("pre-release 2.0.0-beta.1 must not be considered newer than stable 2.0.0")
	}
}

// ---------------------------------------------------------------------------
// CheckForUpdate – error paths
// ---------------------------------------------------------------------------

func TestCheckForUpdate_NetworkError_Darwin(t *testing.T) {
	netErr := errors.New("connection refused")
	svc := newTestService(errorClient(netErr), "1.0.0", platDarwin)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on network failure, got nil")
	}
	if !errors.Is(err, netErr) {
		t.Errorf("expected wrapped netErr, got: %v", err)
	}
}

func TestCheckForUpdate_NetworkError_Windows(t *testing.T) {
	netErr := errors.New("connection refused")
	svc := newTestService(errorClient(netErr), "1.0.0", platWindows)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on network failure, got nil")
	}
	if !errors.Is(err, netErr) {
		t.Errorf("expected wrapped netErr, got: %v", err)
	}
}

func TestCheckForUpdate_NetworkError_Linux(t *testing.T) {
	netErr := errors.New("connection refused")
	svc := newTestService(errorClient(netErr), "1.0.0", platLinux)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on network failure, got nil")
	}
	if !errors.Is(err, netErr) {
		t.Errorf("expected wrapped netErr, got: %v", err)
	}
}

func TestCheckForUpdate_HTTPNon200_Linux(t *testing.T) {
	mock := &mockHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusNotFound,
				Body:       io.NopCloser(strings.NewReader("")),
			}, nil
		},
	}
	svc := newTestService(mock, "1.0.0", platLinux)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on HTTP 404, got nil")
	}
}

func TestCheckForUpdate_MalformedJSON_Darwin(t *testing.T) {
	svc := newTestService(staticClient(`{not valid json`), "1.0.0", platDarwin)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on malformed JSON, got nil")
	}
}

func TestCheckForUpdate_InvalidManifestVersion_Windows(t *testing.T) {
	svc := newTestService(staticClient(`{"version":"not-semver","platforms":{}}`), "1.0.0", platWindows)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error for non-semver manifest version")
	}
}

func TestCheckForUpdate_InvalidCurrentVersion_Linux(t *testing.T) {
	mock := staticClient(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "not-semver", platLinux)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error for non-semver current version")
	}
}

func TestCheckForUpdate_MissingPlatformKey_Darwin(t *testing.T) {
	// Manifest only contains Linux and Windows keys.
	mock := staticClient(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "1.0.0", platDarwin)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error when darwin key is absent from manifest")
	}
}

func TestCheckForUpdate_MissingPlatformKey_Windows(t *testing.T) {
	// Manifest only contains a Linux key.
	mock := staticClient(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "1.0.0", platWindows)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error when windows key is absent from manifest")
	}
}

func TestCheckForUpdate_MissingPlatformKey_Linux(t *testing.T) {
	// Manifest only contains a Darwin key.
	mock := staticClient(manifestJSON("2.0.0", "darwin-aarch64", "https://dl.example.com/app.dmg"))
	svc := newTestService(mock, "1.0.0", platLinux)

	_, err := svc.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error when linux key is absent from manifest")
	}
}

// ---------------------------------------------------------------------------
// CheckForUpdate – caching (platform-agnostic; Linux used throughout)
// ---------------------------------------------------------------------------

func TestCheckForUpdate_CacheHitAvoidsDuplicateHTTPCall(t *testing.T) {
	mock := staticClient(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "1.0.0", platLinux)

	for range 5 {
		if _, err := svc.CheckForUpdate(); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if calls := mock.Calls(); calls != 1 {
		t.Errorf("expected exactly 1 HTTP call due to cache, got %d", calls)
	}
}

func TestCheckForUpdate_CacheExpiryTriggersFreshFetch(t *testing.T) {
	mock := staticClient(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app"))
	svc := newTestService(mock, "1.0.0", platLinux)
	svc.cache.ttl = 30 * time.Millisecond

	if _, err := svc.CheckForUpdate(); err != nil {
		t.Fatalf("first call: %v", err)
	}
	time.Sleep(50 * time.Millisecond) // let TTL expire
	if _, err := svc.CheckForUpdate(); err != nil {
		t.Fatalf("second call: %v", err)
	}
	if calls := mock.Calls(); calls != 2 {
		t.Errorf("expected 2 HTTP calls after cache expiry, got %d", calls)
	}
}

func TestCheckForUpdate_ConcurrentCallsDeduplicateToSingleRequest(t *testing.T) {
	started := make(chan struct{})
	mock := &mockHTTPClient{
		response: func(_ int) (*http.Response, error) {
			select {
			case <-started:
			default:
				close(started)
			}
			time.Sleep(30 * time.Millisecond) // simulate slow network
			return jsonResponse(manifestJSON("2.0.0", "linux-x86_64", "https://dl.example.com/app")), nil
		},
	}
	svc := newTestService(mock, "1.0.0", platLinux)

	const goroutines = 20
	var wg sync.WaitGroup
	errs := make([]error, goroutines)

	for i := range goroutines {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, errs[idx] = svc.CheckForUpdate()
		}(i)
	}
	<-started
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("goroutine %d returned error: %v", i, err)
		}
	}
	if calls := mock.Calls(); calls != 1 {
		t.Errorf("expected 1 HTTP call for %d concurrent callers, got %d", goroutines, calls)
	}
}

func TestCheckForUpdate_CacheStoresErrorAndReturnsItToWaiters(t *testing.T) {
	netErr := errors.New("timeout")
	mock := &mockHTTPClient{
		response: func(_ int) (*http.Response, error) {
			time.Sleep(10 * time.Millisecond)
			return nil, netErr
		},
	}
	svc := newTestService(mock, "1.0.0", platLinux)

	const goroutines = 5
	var wg sync.WaitGroup
	errs := make([]error, goroutines)
	for i := range goroutines {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, errs[idx] = svc.CheckForUpdate()
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err == nil {
			t.Errorf("goroutine %d: expected error, got nil", i)
		}
	}
	if calls := mock.Calls(); calls != 1 {
		t.Errorf("expected single in-flight request even on error, got %d calls", calls)
	}
}

// ---------------------------------------------------------------------------
// Platform – ManifestKey
// ---------------------------------------------------------------------------

func TestPlatform_ManifestKey(t *testing.T) {
	cases := []struct {
		name     string
		platform Platform
		wantKey  string
		wantErr  bool
	}{
		// darwin
		{"darwin aarch64", Platform{OS: "darwin", Arch: "aarch64"}, "darwin-aarch64", false},
		{"darwin x86_64", Platform{OS: "darwin", Arch: "x86_64"}, "darwin-x86_64", false},
		// windows
		{"windows portable x86_64", Platform{OS: "windows", Arch: "x86_64", Variant: "portable"}, "windows-x86_64-portable", false},
		{"windows installer x86_64", Platform{OS: "windows", Arch: "x86_64", Variant: "installer"}, "windows-x86_64-installer", false},
		// linux
		{"linux raw x86_64", Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}, "linux-x86_64", false},
		{"linux deb x86_64", Platform{OS: "linux", Arch: "x86_64", Variant: "deb"}, "linux-x86_64-deb", false},
		{"linux raw aarch64", Platform{OS: "linux", Arch: "aarch64", Variant: "raw"}, "linux-aarch64", false},
		{"linux deb aarch64", Platform{OS: "linux", Arch: "aarch64", Variant: "deb"}, "linux-aarch64-deb", false},
		// unsupported
		{"unsupported OS", Platform{OS: "plan9", Arch: "x86_64"}, "", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.platform.ManifestKey()
			if (err != nil) != tc.wantErr {
				t.Fatalf("ManifestKey() error = %v, wantErr = %v", err, tc.wantErr)
			}
			if !tc.wantErr && got != tc.wantKey {
				t.Errorf("got %q, want %q", got, tc.wantKey)
			}
		})
	}
}

func TestPlatform_IsPortableWindows(t *testing.T) {
	cases := []struct {
		p    Platform
		want bool
	}{
		{Platform{OS: "windows", Variant: "portable"}, true},
		{Platform{OS: "windows", Variant: "installer"}, false},
		{Platform{OS: "darwin"}, false},
		{Platform{OS: "linux", Variant: "raw"}, false},
	}
	for _, tc := range cases {
		if got := tc.p.IsPortableWindows(); got != tc.want {
			t.Errorf("IsPortableWindows(%+v) = %v, want %v", tc.p, got, tc.want)
		}
	}
}

func TestPlatform_IsBinaryLinux(t *testing.T) {
	cases := []struct {
		p    Platform
		want bool
	}{
		{Platform{OS: "linux", Variant: "raw"}, true},
		{Platform{OS: "linux", Variant: "deb"}, false},
		{Platform{OS: "darwin"}, false},
		{Platform{OS: "windows", Variant: "portable"}, false},
	}
	for _, tc := range cases {
		if got := tc.p.IsBinaryLinux(); got != tc.want {
			t.Errorf("IsBinaryLinux(%+v) = %v, want %v", tc.p, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// normaliseArch
// ---------------------------------------------------------------------------

func TestNormaliseArch(t *testing.T) {
	cases := []struct{ in, want string }{
		{"amd64", "x86_64"},
		{"arm64", "aarch64"},
		{"386", "386"},
		{"riscv64", "riscv64"},
	}
	for _, tc := range cases {
		if got := normaliseArch(tc.in); got != tc.want {
			t.Errorf("normaliseArch(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// resolvePlatformURL
// ---------------------------------------------------------------------------

func TestResolvePlatformURL_Found_Darwin(t *testing.T) {
	platforms := map[string]PlatformManifest{
		"darwin-aarch64": {URL: "https://dl.example.com/app.dmg"},
	}
	url, err := resolvePlatformURL(platforms, platDarwin)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://dl.example.com/app.dmg" {
		t.Errorf("got %q", url)
	}
}

func TestResolvePlatformURL_Found_Windows(t *testing.T) {
	platforms := map[string]PlatformManifest{
		"windows-x86_64-portable": {URL: "https://dl.example.com/app.exe"},
	}
	url, err := resolvePlatformURL(platforms, platWindows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://dl.example.com/app.exe" {
		t.Errorf("got %q", url)
	}
}

func TestResolvePlatformURL_Found_Linux(t *testing.T) {
	platforms := map[string]PlatformManifest{
		"linux-x86_64": {URL: "https://dl.example.com/app"},
	}
	url, err := resolvePlatformURL(platforms, platLinux)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://dl.example.com/app" {
		t.Errorf("got %q", url)
	}
}

func TestResolvePlatformURL_MissingKey(t *testing.T) {
	// Each platform is tested against a manifest that only contains the other two.
	cases := []struct {
		name     string
		platform Platform
		manifest map[string]PlatformManifest
	}{
		{
			"darwin key absent",
			platDarwin,
			map[string]PlatformManifest{
				"linux-x86_64":            {URL: "https://dl.example.com/app"},
				"windows-x86_64-portable": {URL: "https://dl.example.com/app.exe"},
			},
		},
		{
			"windows key absent",
			platWindows,
			map[string]PlatformManifest{
				"darwin-aarch64": {URL: "https://dl.example.com/app.dmg"},
				"linux-x86_64":   {URL: "https://dl.example.com/app"},
			},
		},
		{
			"linux key absent",
			platLinux,
			map[string]PlatformManifest{
				"darwin-aarch64":          {URL: "https://dl.example.com/app.dmg"},
				"windows-x86_64-portable": {URL: "https://dl.example.com/app.exe"},
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := resolvePlatformURL(tc.manifest, tc.platform)
			if err == nil {
				t.Fatal("expected error for missing platform key, got nil")
			}
		})
	}
}

func TestResolvePlatformURL_EmptyURL(t *testing.T) {
	cases := []struct {
		name     string
		platform Platform
		key      string
	}{
		{"darwin empty url", platDarwin, "darwin-aarch64"},
		{"windows empty url", platWindows, "windows-x86_64-portable"},
		{"linux empty url", platLinux, "linux-x86_64"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := resolvePlatformURL(map[string]PlatformManifest{tc.key: {URL: ""}}, tc.platform)
			if err == nil {
				t.Fatal("expected error for empty URL, got nil")
			}
		})
	}
}

func TestResolvePlatformURL_UnsupportedPlatform(t *testing.T) {
	_, err := resolvePlatformURL(map[string]PlatformManifest{}, Platform{OS: "plan9", Arch: "x86_64"})
	if err == nil {
		t.Fatal("expected error for unsupported OS, got nil")
	}
}

// ---------------------------------------------------------------------------
// fetchWithRetry
// ---------------------------------------------------------------------------

func TestFetchWithRetry_SucceedsFirstAttempt(t *testing.T) {
	mock := staticClient(`{}`)
	resp, err := fetchWithRetry(mock, "https://fake.invalid/", 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	resp.Body.Close()
	if mock.Calls() != 1 {
		t.Errorf("expected 1 call, got %d", mock.Calls())
	}
}

func TestFetchWithRetry_ExhaustsAllAttempts(t *testing.T) {
	netErr := errors.New("no route to host")
	mock := errorClient(netErr)

	_, err := fetchWithRetry(mock, "https://fake.invalid/", 3)
	if err == nil {
		t.Fatal("expected error after all retries exhausted")
	}
	if !errors.Is(err, netErr) {
		t.Errorf("expected wrapped netErr, got: %v", err)
	}
	if mock.Calls() != 3 {
		t.Errorf("expected 3 attempts, got %d", mock.Calls())
	}
}

func TestFetchWithRetry_SucceedsAfterTransientFailure(t *testing.T) {
	mock := &mockHTTPClient{
		response: func(attempt int) (*http.Response, error) {
			if attempt < 3 {
				return nil, errors.New("transient error")
			}
			return jsonResponse(`{}`), nil
		},
	}
	resp, err := fetchWithRetry(mock, "https://fake.invalid/", 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	resp.Body.Close()
	if mock.Calls() != 3 {
		t.Errorf("expected 3 calls, got %d", mock.Calls())
	}
}

func TestFetchWithRetry_SingleAttemptNoRetry(t *testing.T) {
	mock := errorClient(errors.New("fail"))
	_, err := fetchWithRetry(mock, "https://fake.invalid/", 1)
	if err == nil {
		t.Fatal("expected error")
	}
	if mock.Calls() != 1 {
		t.Errorf("maxAttempts=1 should try exactly once, got %d calls", mock.Calls())
	}
}

func TestFetchWithRetry_HTTP500RetriedThenFails(t *testing.T) {
	mock := &mockHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Body:       io.NopCloser(strings.NewReader("")),
			}, nil
		},
	}
	_, err := fetchWithRetry(mock, "https://fake.invalid/", 2)
	if err == nil {
		t.Fatal("expected error for repeated HTTP 500")
	}
	if mock.Calls() != 2 {
		t.Errorf("expected 2 attempts for HTTP 500, got %d", mock.Calls())
	}
}

// ---------------------------------------------------------------------------
// parseDMGMountPoint (darwin-specific)
// ---------------------------------------------------------------------------

func TestParseDMGMountPoint(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name:  "standard three-column hdiutil output",
			input: "/dev/disk4\t\t/Volumes/MyApp 2.0\n",
			want:  "/Volumes/MyApp 2.0",
		},
		{
			name:  "multiple lines – last mount point wins",
			input: "/dev/disk4s1\t\t\n/dev/disk4s2\t\t/Volumes/MyApp\n",
			want:  "/Volumes/MyApp",
		},
		{
			name:    "empty output",
			input:   "",
			wantErr: true,
		},
		{
			name:    "no tab-separated columns",
			input:   "/dev/disk4\n",
			wantErr: true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseDMGMountPoint(tc.input)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr = %v", err, tc.wantErr)
			}
			if !tc.wantErr && got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// singleQuote (linux-specific shell quoting)
// ---------------------------------------------------------------------------

func TestSingleQuote(t *testing.T) {
	cases := []struct{ in, want string }{
		{"/tmp/update", "'/tmp/update'"},
		{"it's a path", "'it'\\''s a path'"},
		{"no'quotes'here", "'no'\\''quotes'\\''here'"},
		{"", "''"},
		{"/home/user/my app", "'/home/user/my app'"},
	}
	for _, tc := range cases {
		if got := singleQuote(tc.in); got != tc.want {
			t.Errorf("singleQuote(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// buildLinuxUpdateScript (linux-specific)
// ---------------------------------------------------------------------------

func TestBuildLinuxUpdateScript_ContainsRequiredParts(t *testing.T) {
	script := buildLinuxUpdateScript(1234, "/tmp/new-binary", "/usr/local/bin/myapp")

	checks := []struct {
		desc   string
		substr string
	}{
		{"waits for pid", "1234"},
		{"copies tmp to self", "'/tmp/new-binary'"},
		{"destination self", "'/usr/local/bin/myapp'"},
		{"chmod +x", "chmod +x"},
		{"self-delete script", `rm -- "$0"`},
		{"launches updated binary in background", "'/usr/local/bin/myapp' &"},
	}
	for _, c := range checks {
		if !strings.Contains(script, c.substr) {
			t.Errorf("[%s] script missing %q\nscript:\n%s", c.desc, c.substr, script)
		}
	}
}

func TestBuildLinuxUpdateScript_SingleQuotesPathsWithSpaces(t *testing.T) {
	script := buildLinuxUpdateScript(99, "/tmp/new app", "/home/user/my app")

	if !strings.Contains(script, "'/tmp/new app'") {
		t.Errorf("tmpPath with space not single-quoted:\n%s", script)
	}
	if !strings.Contains(script, "'/home/user/my app'") {
		t.Errorf("self path with space not single-quoted:\n%s", script)
	}
}

func TestBuildLinuxUpdateScript_EscapesSingleQuoteInPath(t *testing.T) {
	script := buildLinuxUpdateScript(1, "/tmp/it's here", "/usr/bin/app")
	if !strings.Contains(script, `'/tmp/it'\''s here'`) {
		t.Errorf("single quote in path not escaped correctly:\n%s", script)
	}
}

// ---------------------------------------------------------------------------
// escapePSPath (windows-specific PowerShell quoting)
// ---------------------------------------------------------------------------

func TestEscapePSPath(t *testing.T) {
	cases := []struct{ in, want string }{
		{`C:\Users\Bob\app.exe`, `"C:\Users\Bob\app.exe"`},
		{`C:\path with spaces\app.exe`, `"C:\path with spaces\app.exe"`},
		{"has`backtick", `"has` + "``" + `backtick"`},
		{`has"quote`, `"has` + "`\"" + `quote"`},
		{`has$var`, `"has` + "`$" + `var"`},
	}
	for _, tc := range cases {
		if got := escapePSPath(tc.in); got != tc.want {
			t.Errorf("escapePSPath(%q)\n  got  %q\n  want %q", tc.in, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// progressWriter
// ---------------------------------------------------------------------------

func TestProgressWriter_ReportsProgress(t *testing.T) {
	var progresses []DownloadProgress
	pw := &progressWriter{
		dest:  io.Discard,
		total: 100,
		onProgress: func(p DownloadProgress) {
			progresses = append(progresses, p)
		},
	}

	pw.Write(make([]byte, 50))
	pw.Write(make([]byte, 50))

	if len(progresses) == 0 {
		t.Fatal("expected at least one progress event, got none")
	}
	last := progresses[len(progresses)-1]
	if last.BytesDownloaded != 100 {
		t.Errorf("BytesDownloaded = %d, want 100", last.BytesDownloaded)
	}
	if last.Percent != 100 {
		t.Errorf("Percent = %d, want 100", last.Percent)
	}
}

func TestProgressWriter_HandlesUnknownContentLength(t *testing.T) {
	pw := &progressWriter{
		dest:  io.Discard,
		total: -1, // http.Response.ContentLength is -1 when not set
		onProgress: func(p DownloadProgress) {
			if p.Percent != 0 {
				t.Errorf("expected Percent=0 for unknown total, got %d", p.Percent)
			}
		},
	}
	pw.Write(make([]byte, 1024))
}

func TestProgressWriter_NilCallbackDoesNotPanic(t *testing.T) {
	pw := &progressWriter{dest: io.Discard, total: 100, onProgress: nil}
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Write panicked with nil onProgress: %v", r)
		}
	}()
	pw.Write(make([]byte, 50))
}

// ---------------------------------------------------------------------------
// cachedResult.valid
// ---------------------------------------------------------------------------

func TestCachedResult_Valid(t *testing.T) {
	cr := cachedResult{ttl: 10 * time.Minute}

	if cr.valid() {
		t.Error("zero-value cachedResult should not be valid")
	}

	cr.at = time.Now()
	if !cr.valid() {
		t.Error("freshly set cache should be valid")
	}

	cr.at = time.Now().Add(-20 * time.Minute)
	if cr.valid() {
		t.Error("expired cache should not be valid")
	}
}
