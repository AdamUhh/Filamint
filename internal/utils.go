package internal

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

func GetAppDataDir() (string, error) {
	var base string
	switch runtime.GOOS {
	case "windows":
		// C:\Users\<user>\AppData\Roaming\filament-tracker/
		base = os.Getenv("APPDATA")
		if base == "" {
			return "", fmt.Errorf("APPDATA env var not set")
		}
	case "darwin":
		// /Users/<user>/Library/Application Support/filament-tracker/
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, "Library", "Application Support")
	default:
		// /home/<user>/.local/share/filament-tracker/
		base = os.Getenv("XDG_DATA_HOME")
		if base == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			base = filepath.Join(home, ".local", "share")
		}
	}

	dir := filepath.Join(base, "filament-tracker")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create app data dir: %w", err)
	}
	return dir, nil
}

func ConvertBoolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// ----------
// Query
// ----------
// tokenize splits search input into tokens, respecting key:"quoted value" syntax.
func tokenize(search string) []string {
	re := regexp.MustCompile(`\w+:"[^"]*"|\S+`)
	return re.FindAllString(strings.TrimSpace(search), -1)
}

func ParseSearchQuery(search string) (qualifiers map[string]string, freeText string) {
	qualifiers = make(map[string]string)
	var freeTextParts []string

	for _, token := range tokenize(search) {
		colonIdx := strings.Index(token, ":")
		if colonIdx > 0 {
			key := strings.ToLower(token[:colonIdx])
			value := token[colonIdx+1:]
			if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
				value = value[1 : len(value)-1]
			}
			if value != "" {
				qualifiers[key] = strings.ToLower(value)
				continue
			}
		}
		if token != "" {
			freeTextParts = append(freeTextParts, token)
		}
	}

	freeText = strings.Join(freeTextParts, " ")
	return
}

// BuildQualifierClause returns a WHERE fragment and arg for a single qualifier.
// Wildcards (*) are converted to SQL LIKE patterns.
func BuildQualifierClause(column, val string) (clause string, arg any) {
	if strings.Contains(val, "*") {
		return fmt.Sprintf("LOWER(%s) LIKE ?", column), strings.ReplaceAll(val, "*", "%")
	}
	return fmt.Sprintf("LOWER(%s) = ?", column), val
}
