import { useEffect, useState } from "react";

import { DEFAULT_THEME, THEMES, type Theme } from "@/lib/constant-theme";

export function useThemeSettings() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== "undefined" && window.__theme)
            return window.__theme;
        return DEFAULT_THEME;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        window.__onThemeChange = (newTheme: Theme) => setThemeState(newTheme);

        return () => {
            window.__onThemeChange = undefined;
        };
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);

        if (typeof window !== "undefined" && window.__setPreferredTheme) {
            window.__setPreferredTheme(newTheme);
        }
    };

    const toggleTheme = () => {
        const currentIndex = THEMES.findIndex((t) => t === theme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        setTheme(THEMES[nextIndex]);
    };

    return { theme, setTheme, toggleTheme };
}
