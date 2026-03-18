package updater

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

// --- Fake HTTP client ---

type fakeHTTPClient struct {
	mu       sync.Mutex
	calls    int
	response func(attempt int) (*http.Response, error)
}

func (f *fakeHTTPClient) Get(url string) (*http.Response, error) {
	f.mu.Lock()
	f.calls++
	attempt := f.calls
	f.mu.Unlock()
	return f.response(attempt)
}

func jsonBody(v any) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(strings.NewReader(string(b)))
}

func okResponse(body io.ReadCloser) *http.Response {
	return &http.Response{StatusCode: http.StatusOK, Body: body, ContentLength: -1}
}

func manifestResponse(m Manifest) *http.Response {
	return okResponse(jsonBody(m))
}

// --- Helpers ---

func newTestUpdater(client HTTPClient, currentVersion string) *UpdateService {
	s := &UpdateService{
		currentVersion: currentVersion,
		manifestURL:    "http://fake/manifest.json",
		client:         client,
		platform:       Platform{OS: "linux", Arch: "x86_64", Variant: "raw"},
		cache:          cachedResult{ttl: 10 * time.Minute},
	}
	s.cond = sync.NewCond(&s.mu)
	return s
}

func makeManifest(version string) Manifest {
	return Manifest{
		Version: version,
		Notes:   "some notes",
		PubDate: "2025-01-01",
		Platforms: map[string]PlatformManifest{
			"linux-x86_64": {URL: "http://fake/update"},
		},
	}
}

// --- CheckForUpdate tests ---

func TestCheckForUpdate_UpdateAvailable(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(makeManifest("2.0.0")), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	info, err := s.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Available {
		t.Error("expected update to be available")
	}
	if info.NewVersion != "2.0.0" {
		t.Errorf("NewVersion = %q, want 2.0.0", info.NewVersion)
	}
	if info.CurrentVersion != "1.0.0" {
		t.Errorf("CurrentVersion = %q, want 1.0.0", info.CurrentVersion)
	}
	if info.DownloadURL != "http://fake/update" {
		t.Errorf("DownloadURL = %q, want http://fake/update", info.DownloadURL)
	}
}

func TestCheckForUpdate_NoUpdate(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(makeManifest("1.0.0")), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	info, err := s.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected no update to be available")
	}
	if info.DownloadURL != "" {
		t.Errorf("DownloadURL should be empty when no update, got %q", info.DownloadURL)
	}
}

func TestCheckForUpdate_OlderManifest(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(makeManifest("0.9.0")), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	info, err := s.CheckForUpdate()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Available {
		t.Error("expected no update for older manifest version")
	}
}

func TestCheckForUpdate_NetworkError(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return nil, fmt.Errorf("connection refused")
		},
	}
	s := newTestUpdater(client, "1.0.0")

	_, err := s.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestCheckForUpdate_HTTPError(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Body:       io.NopCloser(strings.NewReader("")),
			}, nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	_, err := s.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on HTTP 500")
	}
}

func TestCheckForUpdate_BadManifestJSON(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return okResponse(io.NopCloser(strings.NewReader("not json{{{"))), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	_, err := s.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on invalid JSON")
	}
}

func TestCheckForUpdate_InvalidCurrentVersion(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(makeManifest("2.0.0")), nil
		},
	}
	s := newTestUpdater(client, "not-a-semver")

	_, err := s.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on invalid current version")
	}
}

func TestCheckForUpdate_InvalidManifestVersion(t *testing.T) {
	m := makeManifest("bad-version")
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(m), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	_, err := s.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error on invalid manifest version")
	}
}

func TestCheckForUpdate_MissingPlatformURL(t *testing.T) {
	m := Manifest{
		Version:   "2.0.0",
		Platforms: map[string]PlatformManifest{}, // no linux-x86_64 entry
	}
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(m), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	_, err := s.CheckForUpdate()
	if err == nil {
		t.Fatal("expected error when platform URL is missing")
	}
}

// --- Cache tests ---

func TestCheckForUpdate_CacheIsUsed(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(makeManifest("2.0.0")), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	_, _ = s.CheckForUpdate()
	_, _ = s.CheckForUpdate()
	_, _ = s.CheckForUpdate()

	if client.calls != 1 {
		t.Errorf("expected 1 HTTP call due to caching, got %d", client.calls)
	}
}

func TestCheckForUpdate_CacheExpires(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return manifestResponse(makeManifest("2.0.0")), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")
	s.cache.ttl = 1 * time.Millisecond // very short TTL

	_, _ = s.CheckForUpdate()
	time.Sleep(5 * time.Millisecond)
	_, _ = s.CheckForUpdate()

	if client.calls < 2 {
		t.Errorf("expected at least 2 HTTP calls after cache expiry, got %d", client.calls)
	}
}

func TestCachedResult_ValidAndExpired(t *testing.T) {
	c := cachedResult{ttl: 10 * time.Minute}
	if c.valid() {
		t.Error("zero-value cache should not be valid")
	}

	c.at = time.Now()
	if !c.valid() {
		t.Error("freshly set cache should be valid")
	}

	c.at = time.Now().Add(-20 * time.Minute)
	if c.valid() {
		t.Error("old cache should not be valid")
	}
}

// --- Concurrent CheckForUpdate: only one in-flight request ---

func TestCheckForUpdate_ConcurrentDeduplicated(t *testing.T) {
	calls := 0
	mu := sync.Mutex{}
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			mu.Lock()
			calls++
			mu.Unlock()
			time.Sleep(20 * time.Millisecond) // simulate latency
			return manifestResponse(makeManifest("2.0.0")), nil
		},
	}
	s := newTestUpdater(client, "1.0.0")

	var wg sync.WaitGroup
	for range 10 {
		wg.Go(func() {
			info, err := s.CheckForUpdate()
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if !info.Available {
				t.Error("expected update available")
			}
		})
	}
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Errorf("expected exactly 1 HTTP call from concurrent requests, got %d", calls)
	}
}

// --- fetchWithRetry tests ---

func TestFetchWithRetry_SucceedsFirstAttempt(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return okResponse(io.NopCloser(strings.NewReader("ok"))), nil
		},
	}
	resp, err := fetchWithRetry(client, "http://fake", 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	if client.calls != 1 {
		t.Errorf("expected 1 call, got %d", client.calls)
	}
}

func TestFetchWithRetry_ExhaustsAttempts(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return nil, fmt.Errorf("timeout")
		},
	}
	_, err := fetchWithRetry(client, "http://fake", 3)
	if err == nil {
		t.Fatal("expected error after all attempts failed")
	}
	if client.calls != 3 {
		t.Errorf("expected 3 calls, got %d", client.calls)
	}
}

func TestFetchWithRetry_SucceedsOnRetry(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(attempt int) (*http.Response, error) {
			if attempt < 3 {
				return nil, fmt.Errorf("transient error")
			}
			return okResponse(io.NopCloser(strings.NewReader("ok"))), nil
		},
	}
	resp, err := fetchWithRetry(client, "http://fake", 3)
	if err != nil {
		t.Fatalf("expected success on 3rd attempt, got: %v", err)
	}
	defer resp.Body.Close()
	if client.calls != 3 {
		t.Errorf("expected 3 calls, got %d", client.calls)
	}
}

func TestFetchWithRetry_HTTP404IsAnError(t *testing.T) {
	client := &fakeHTTPClient{
		response: func(_ int) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusNotFound,
				Body:       io.NopCloser(strings.NewReader("")),
			}, nil
		},
	}
	_, err := fetchWithRetry(client, "http://fake", 2)
	if err == nil {
		t.Fatal("expected error on HTTP 404")
	}
}

// --- resolvePlatformURL tests ---

func TestResolvePlatformURL(t *testing.T) {
	platforms := map[string]PlatformManifest{
		"linux-x86_64":   {URL: "http://example.com/linux.bin"},
		"darwin-aarch64": {URL: "http://example.com/mac.dmg"},
	}

	t.Run("found", func(t *testing.T) {
		p := Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}
		url, err := resolvePlatformURL(platforms, p)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if url != "http://example.com/linux.bin" {
			t.Errorf("got %q", url)
		}
	})

	t.Run("not found", func(t *testing.T) {
		p := Platform{OS: "linux", Arch: "aarch64", Variant: "raw"}
		_, err := resolvePlatformURL(platforms, p)
		if err == nil {
			t.Fatal("expected error for missing platform")
		}
	})

	t.Run("empty URL in manifest", func(t *testing.T) {
		platforms2 := map[string]PlatformManifest{
			"linux-x86_64": {URL: ""},
		}
		p := Platform{OS: "linux", Arch: "x86_64", Variant: "raw"}
		_, err := resolvePlatformURL(platforms2, p)
		if err == nil {
			t.Fatal("expected error for empty URL")
		}
	})
}

// --- progressWriter tests ---

func TestProgressWriter_ReportsPercent(t *testing.T) {
	var lastPct int
	var callCount int

	pw := &progressWriter{
		dest:  io.Discard,
		total: 100,
		onProgress: func(p DownloadProgress) {
			lastPct = p.Percent
			callCount++
		},
	}

	// Write in 20-byte chunks - each chunk crosses a 20% threshold
	for range 5 {
		n, err := pw.Write(make([]byte, 20))
		if n != 20 || err != nil {
			t.Fatalf("Write failed: n=%d err=%v", n, err)
		}
	}

	if lastPct != 100 {
		t.Errorf("expected final percent=100, got %d", lastPct)
	}
	// Should have fired at 20%, 40%, 60%, 80%, 100%
	if callCount != 5 {
		t.Errorf("expected 5 progress callbacks, got %d", callCount)
	}
}

func TestProgressWriter_UnknownTotalSize(t *testing.T) {
	pw := &progressWriter{
		dest:  io.Discard,
		total: -1, // unknown content length
		onProgress: func(p DownloadProgress) {
			if p.Percent != 0 {
				t.Errorf("expected percent=0 for unknown total, got %d", p.Percent)
			}
		},
	}
	pw.Write(make([]byte, 512))
}

func TestProgressWriter_ZeroTotal(t *testing.T) {
	pw := &progressWriter{
		dest:  io.Discard,
		total: 0,
		onProgress: func(p DownloadProgress) {
			if p.Percent != 0 {
				t.Errorf("expected percent=0 for zero total, got %d", p.Percent)
			}
		},
	}
	pw.Write(make([]byte, 1))
}

func TestProgressWriter_NilCallback(t *testing.T) {
	pw := &progressWriter{
		dest:       io.Discard,
		total:      100,
		onProgress: nil, // should not panic
	}
	if _, err := pw.Write(make([]byte, 50)); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

// --- stagedInstaller atomic value ---

func TestStagedInstaller(t *testing.T) {
	s := &UpdateService{}

	// Before any store, Load should return empty string
	path, _ := s.stagedInstaller.Load().(string)
	if path != "" {
		t.Errorf("expected empty staged installer, got %q", path)
	}

	s.stagedInstaller.Store("/tmp/update.exe")
	path, _ = s.stagedInstaller.Load().(string)
	if path != "/tmp/update.exe" {
		t.Errorf("expected /tmp/update.exe, got %q", path)
	}
}
