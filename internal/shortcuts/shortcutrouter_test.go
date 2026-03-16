package shortcuts

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// Route matching
func TestRouter_ExactMatch(t *testing.T) {
	r := NewShortcutRouter(RouteMap{
		"/":       {"window"},
		"/spools": {"window", "spool", "print"},
	})
	r.SetWindowRoute("main", "/spools")
	assert.Equal(t, []string{"window", "spool", "print"}, r.AllowedCategories("main"))
}

func TestRouter_PrefixMatch(t *testing.T) {
	r := NewShortcutRouter(DefaultRouteMap)
	r.SetWindowRoute("main", "/spools/123/edit")
	assert.Contains(t, r.AllowedCategories("main"), "spool")
}

func TestRouter_LongestPrefixWins(t *testing.T) {
	r := NewShortcutRouter(RouteMap{
		"/":                {"window"},
		"/spools":          {"window", "spool"},
		"/spools/featured": {"window", "spool", "featured"},
	})
	r.SetWindowRoute("main", "/spools/featured/123")
	assert.Equal(t, []string{"window", "spool", "featured"}, r.AllowedCategories("main"))
}

func TestRouter_FallbackToRoot(t *testing.T) {
	r := NewShortcutRouter(DefaultRouteMap)
	r.SetWindowRoute("main", "/unknown/route")
	assert.Equal(t, []string{"window"}, r.AllowedCategories("main"))
}

func TestRouter_MissingRootEntry(t *testing.T) {
	r := NewShortcutRouter(RouteMap{
		"/spools": {"window", "spool"},
	})
	r.SetWindowRoute("main", "/unknown")
	// should not panic, should return something safe
	assert.NotNil(t, r.AllowedCategories("main"))
}

func TestRouter_EmptyRouteFallsBackToRoot(t *testing.T) {
	r := NewShortcutRouter(DefaultRouteMap)
	r.SetWindowRoute("main", "")
	assert.Equal(t, []string{"window"}, r.AllowedCategories("main"))
}

// Window state

func TestRouter_UnknownWindow(t *testing.T) {
	r := NewShortcutRouter(DefaultRouteMap)
	assert.Equal(t, []string{"window"}, r.AllowedCategories("never-seen"))
}

func TestRouter_MultipleWindowsAreIndependent(t *testing.T) {
	r := NewShortcutRouter(DefaultRouteMap)
	r.SetWindowRoute("main", "/spools")
	r.SetWindowRoute("secondary", "/")
	assert.Contains(t, r.AllowedCategories("main"), "spool")
	assert.Equal(t, []string{"window"}, r.AllowedCategories("secondary"))
}

func TestRouter_RouteUpdateOverwritesPrevious(t *testing.T) {
	r := NewShortcutRouter(DefaultRouteMap)
	r.SetWindowRoute("main", "/spools")
	r.SetWindowRoute("main", "/")
	assert.Equal(t, []string{"window"}, r.AllowedCategories("main"))
}

// Default shortcuts

func TestDefaultShortcuts_AllHaveRequiredFields(t *testing.T) {
	for _, sc := range DefaultShortcuts() {
		assert.NotEmpty(t, sc.Action, "action should not be empty")
		assert.NotEmpty(t, sc.KeyCombo, "key combo should not be empty for %q", sc.Action)
		assert.NotEmpty(t, sc.Category, "category should not be empty for %q", sc.Action)
	}
}

func TestDefaultShortcuts_ActionsAreUnique(t *testing.T) {
	seen := make(map[string]bool)
	for _, sc := range DefaultShortcuts() {
		assert.False(t, seen[sc.Action], "duplicate action %q in defaults", sc.Action)
		seen[sc.Action] = true
	}
}

func TestDefaultShortcuts_NoDuplicateCombosWithinSameCategory(t *testing.T) {
	// same combo in the same category is always a bug in the defaults themselves
	type key struct{ combo, category string }
	seen := make(map[key]string)
	for _, sc := range DefaultShortcuts() {
		k := key{sc.KeyCombo, sc.Category}
		prev, exists := seen[k]
		assert.False(t, exists,
			"combo %q used by both %q and %q in category %q",
			sc.KeyCombo, prev, sc.Action, sc.Category,
		)
		seen[k] = sc.Action
	}
}
