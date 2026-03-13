package internal

import (
	"crypto/rand"
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
		// C:\Users\<user>\AppData\Roaming\filamint/
		base = os.Getenv("APPDATA")
		if base == "" {
			return "", fmt.Errorf("APPDATA env var not set")
		}
	case "darwin":
		// /Users/<user>/Library/Application Support/filamint/
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, "Library", "Application Support")
	default:
		// /home/<user>/.local/share/filamint/
		base = os.Getenv("XDG_DATA_HOME")
		if base == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			base = filepath.Join(home, ".local", "share")
		}
	}

	dir := filepath.Join(base, "filamint")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create app data dir: %w", err)
	}
	return dir, nil
}

func GetModelsDir() (string, error) {
	base, err := GetAppDataDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(base, "models")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
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
var tokenizeRe = regexp.MustCompile(`\w+:"[^"]*"|\S+`)

func tokenize(search string) []string {
	return tokenizeRe.FindAllString(strings.TrimSpace(search), -1)
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
				strings.Trim(value, `"`)
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

// ----------
// Spool
// ----------

func Truncate(s string, n int) string {
	r := []rune(s)
	if len(r) < n {
		n = len(r)
	}
	return string(r[:n])
}

func randomSuffix(length int) (string, error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		return "", fmt.Errorf("generating random suffix: %w", err)
	}

	for i := range b {
		b[i] = chars[b[i]%byte(len(chars))]
	}
	return string(b), nil
}

func GenerateSpoolCodeBase(material, color string) (string, error) {
	base := fmt.Sprintf(
		"%s-%s",
		strings.ToUpper(Truncate(material, 3)),
		strings.ToUpper(Truncate(color, 2)),
	)

	suffix, err := randomSuffix(5)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s-%s", base, suffix), nil
}
