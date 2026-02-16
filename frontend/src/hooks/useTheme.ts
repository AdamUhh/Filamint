import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const DEFAULT_THEME: Theme = "light";

export function useThemeSettings() {
    // Initialize from pre-hydration window value
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== "undefined" && window.__theme) {
            return window.__theme;
        }
        return DEFAULT_THEME;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            // Subscribe to theme changes
            window.__onThemeChange = (newTheme: Theme) => {
                setThemeState(newTheme);
            };

            // Sync initial state
            if (window.__theme) {
                setThemeState(window.__theme);
            }
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);

        // Update the global function to persist & apply class
        if (typeof window !== "undefined" && window.__setPreferredTheme) {
            window.__setPreferredTheme(newTheme);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    return { theme, setTheme, toggleTheme };
}
