package main

import (
	"database/sql"
	"fmt"
	"runtime"
	"strings"
	"time"
)

type Shortcut struct {
	ID          int64     `db:"id" json:"id"`
	Action      string    `db:"action" json:"action"`
	KeyCombo    string    `db:"key_combo" json:"keyCombo"`
	Description string    `db:"description" json:"description"`
	Category    string    `db:"category" json:"category"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

type ShortcutService struct {
	db *Database
}

func getModifierKey() string {
	if runtime.GOOS == "darwin" {
		return "Cmd+"
	}
	return "Ctrl+"
}

func getDefaultShortcuts() []Shortcut {
	Ctrl := getModifierKey()

	return []Shortcut{
		// Window shortcuts
		{
			Action:      "window:fullscreen",
			KeyCombo:    "F11",
			Description: "Toggle fullscreen",
			Category:    "window",
		},
		{
			Action:      "window:devtools",
			KeyCombo:    "F12",
			Description: "Open developer tools",
			Category:    "window",
		},
		{
			Action:      "window:reload",
			KeyCombo:    Ctrl + "R",
			Description: "Reload window",
			Category:    "window",
		},

		// Spool shortcuts
		{
			Action:      "spool:toggle_template",
			KeyCombo:    Ctrl + "T",
			Description: "Toggle template mode",
			Category:    "spool",
		},
		{
			Action:      "spool:create",
			KeyCombo:    Ctrl + "N",
			Description: "Create new spool",
			Category:    "spool",
		},
		{
			Action:      "spool:redirect",
			KeyCombo:    Ctrl + "Shift+S",
			Description: "Go to spools page",
			Category:    "spool",
		},

		// Print shortcuts
		{
			Action:      "print:redirect",
			KeyCombo:    Ctrl + "Shift+P",
			Description: "Go to prints page",
			Category:    "print",
		},
		{
			Action:      "print:create",
			KeyCombo:    Ctrl + "N",
			Description: "Create new print",
			Category:    "print",
		},
	}
}

func NewShortcutService(db *Database) *ShortcutService {
	service := &ShortcutService{db: db}

	// Initialize shortcuts on first run
	if err := service.initializeShortcuts(); err != nil {
		fmt.Printf("Warning: failed to initialize shortcuts: %v\n", err)
	}

	return service
}

func (s *ShortcutService) initializeShortcuts() error {
	var count int
	if err := s.db.Get(&count, `SELECT COUNT(1) FROM shortcuts`); err != nil {
		return err
	}

	if count > 0 {
		return nil // already initialized
	}

	defaults := getDefaultShortcuts()
	for _, shortcut := range defaults {
		_, err := s.db.db.NamedExec(`
			INSERT INTO shortcuts (action, key_combo, description, category)
			VALUES (:action, :key_combo, :description, :category)
		`, shortcut)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *ShortcutService) GetShortcutCombo(action string) (string, error) {
	var keyCombo string
	err := s.db.Get(&keyCombo, `
		SELECT key_combo
		FROM shortcuts
		WHERE action = ?
		LIMIT 1
	`, action)

	if err == sql.ErrNoRows {
		return "", nil // Return empty string instead of error for not found
	}

	return keyCombo, err
}

func (s *ShortcutService) GetAllShortcuts() ([]Shortcut, error) {
	var shortcuts []Shortcut
	err := s.db.Select(&shortcuts, `
		SELECT id, action, key_combo, description, category, created_at, updated_at
		FROM shortcuts
		ORDER BY category, action
	`)
	return shortcuts, err
}

func (s *ShortcutService) GetShortcutsByCategory(category string) ([]Shortcut, error) {
	var shortcuts []Shortcut
	err := s.db.Select(&shortcuts, `
		SELECT id, action, key_combo, description, category, created_at, updated_at
		FROM shortcuts
		WHERE category = ?
		ORDER BY action
	`, category)
	return shortcuts, err
}

func (s *ShortcutService) UpdateShortcut(action string, newKeyCombo string) error {
	// Normalize key combo
	newKeyCombo = strings.TrimSpace(newKeyCombo)
	if newKeyCombo == "" {
		return fmt.Errorf("key combo cannot be empty")
	}

	// Check if another shortcut already uses this key combo
	var existingAction string
	err := s.db.Get(&existingAction, `
		SELECT action FROM shortcuts
		WHERE key_combo = ? AND action != ?
		LIMIT 1
	`, newKeyCombo, action)

	if err == nil {
		// Found a duplicate
		return fmt.Errorf("shortcut '%s' is already used by action '%s'", newKeyCombo, existingAction)
	} else if err != sql.ErrNoRows {
		// Actual database error
		return err
	}

	// Update the shortcut
	result, err := s.db.Exec(`
		UPDATE shortcuts
		SET key_combo = ?, updated_at = CURRENT_TIMESTAMP
		WHERE action = ?
	`, newKeyCombo, action)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("shortcut with action '%s' not found", action)
	}

	return nil
}

func (s *ShortcutService) ResetShortcut(action string) error {
	defaults := getDefaultShortcuts()

	for _, defaultShortcut := range defaults {
		if defaultShortcut.Action == action {
			_, err := s.db.Exec(`
				UPDATE shortcuts
				SET key_combo = ?, updated_at = CURRENT_TIMESTAMP
				WHERE action = ?
			`, defaultShortcut.KeyCombo, action)
			return err
		}
	}

	return fmt.Errorf("no default shortcut found for action '%s'", action)
}

func (s *ShortcutService) ResetAllShortcuts() error {
	defaults := getDefaultShortcuts()

	for _, shortcut := range defaults {
		_, err := s.db.Exec(`
			UPDATE shortcuts
			SET key_combo = ?, updated_at = CURRENT_TIMESTAMP
			WHERE action = ?
		`, shortcut.KeyCombo, shortcut.Action)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *ShortcutService) Name() string {
	return "ShortcutService"
}

func (s *ShortcutService) ServiceShutdown() error {
	return nil
}
