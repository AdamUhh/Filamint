package shortcuts

import (
	"strings"
	"sync"
)

// RouteMap maps URL prefixes to the shortcut categories active on that route.
// Exported so tests and callers can inject custom maps.
type RouteMap map[string][]string

var DefaultRouteMap = RouteMap{
	"/":       {"window"},
	"/spools": {"window", "spool", "print"},
	"/prints": {"window", "spool", "print"},
}

// ShortcutRouter resolves a URL route to its allowed shortcut categories,
// and tracks that mapping per named window.
type ShortcutRouter struct {
	routes           RouteMap
	windowCategories map[string][]string
	mu               sync.RWMutex
}

func NewShortcutRouter(routes RouteMap) *ShortcutRouter {
	if routes == nil {
		routes = DefaultRouteMap
	}
	return &ShortcutRouter{
		routes:           routes,
		windowCategories: make(map[string][]string),
	}
}

// SetWindowRoute records the active route for a window name.
func (r *ShortcutRouter) SetWindowRoute(windowName, route string) {
	cats := r.categoriesForRoute(route)
	r.mu.Lock()
	r.windowCategories[windowName] = cats
	r.mu.Unlock()
}

// AllowedCategories returns the categories for a window, defaulting to {"window"}.
func (r *ShortcutRouter) AllowedCategories(windowName string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if cats, ok := r.windowCategories[windowName]; ok {
		return cats
	}
	return []string{"window"}
}

func (r *ShortcutRouter) categoriesForRoute(route string) []string {
	// Exact match first.
	if cats, ok := r.routes[route]; ok {
		return cats
	}
	// Prefix match (longest wins).
	var best string
	for prefix, cats := range r.routes {
		if prefix != "/" && strings.HasPrefix(route, prefix) && len(prefix) > len(best) {
			best = prefix
			_ = cats
		}
	}
	if best != "" {
		return r.routes[best]
	}
	// Fallback to root.
	return r.routes["/"]
}
