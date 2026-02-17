import { type Theme } from "@/lib/constant-theme";

declare global {
    interface Window {
        __theme?: Theme;
        __setPreferredTheme?: (theme: Theme) => void;
        __onThemeChange?: (theme: Theme) => void;
    }
}

const code = function () {
    const DEFAULT_THEME: Theme = "light";

    // NOTE: There’s a separate THEMES array in @/lib/constant-theme for hydration
    // Changes here should be mirrored there.
    const THEMES: Theme[] = [
        "light",
        "dark",
        "beige",
        "minimal",
        "minimal-dark",
        "nlan-dark",
        "brutalist",
    ];

    window.__onThemeChange = function () {};

    function applyTheme(theme: Theme) {
        window.__theme = theme;
        const html = document.documentElement;

        html.setAttribute("data-theme", theme);
        html.classList.remove(...THEMES);
        html.classList.add(theme);

        window?.__onThemeChange?.(theme);
    }

    let preferredTheme: Theme;
    try {
        const stored = localStorage.getItem("theme");
        preferredTheme = THEMES.find((theme) => theme === stored)
            ? (stored as Theme)
            : DEFAULT_THEME;
    } catch {
        preferredTheme = DEFAULT_THEME;
    }

    window.__setPreferredTheme = function (theme: Theme) {
        applyTheme(theme);
        try {
            localStorage.setItem("theme", theme);
        } catch {
            //
        }
    };

    applyTheme(preferredTheme);
};

export const getThemeScript = `(${code})();`;
