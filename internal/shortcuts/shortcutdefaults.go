package shortcuts

import "runtime"

func getModifierKey() string {
	if runtime.GOOS == "darwin" {
		return "Cmd+"
	}
	return "Ctrl+"
}

func DefaultShortcuts() []Shortcut {
	Ctrl := getModifierKey()
	return []Shortcut{
		{Action: "window:fullscreen", KeyCombo: "F11", Description: "Toggle fullscreen", Category: "window"},
		{Action: "window:devtools", KeyCombo: "F12", Description: "Open developer tools", Category: "window", DevOnly: true},
		{Action: "window:reload", KeyCombo: Ctrl + "R", Description: "Reload window", Category: "window", DevOnly: true},
		{Action: "spool:toggle_template", KeyCombo: Ctrl + "T", Description: "Toggle template mode", Category: "spool"},
		{Action: "spool:create", KeyCombo: Ctrl + "N", Description: "Create new spool", Category: "spool"},
		{Action: "spool:redirect", KeyCombo: Ctrl + "Shift+S", Description: "Go to spools page", Category: "spool"},
		{Action: "print:redirect", KeyCombo: Ctrl + "Shift+P", Description: "Go to prints page", Category: "print"},
		{Action: "print:create", KeyCombo: Ctrl + "N", Description: "Create new print", Category: "print"},
	}
}
