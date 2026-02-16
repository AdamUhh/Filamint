// Extend the window object
declare global {
    interface Window {
        __theme?: "light" | "dark";
        __setPreferredTheme?: (theme: "light" | "dark") => void;
        __onThemeChange?: (theme: "light" | "dark") => void;
    }
}

// Vanilla JS code to run before React hydrates
const code = function () {
    console.log("applying code");
    window.__onThemeChange = function () {};

    function applyTheme(theme: "light" | "dark") {
        window.__theme = theme;

        const html = document.documentElement;

        // Set data-theme attribute
        html.setAttribute("data-theme", theme);

        // Remove any previous theme class
        html.classList.remove("light", "dark");

        console.debug("applying", theme);
        // Add the current theme as a class
        html.classList.add(theme);

        window?.__onThemeChange?.(theme);
    }

    let preferredTheme: "light" | "dark";
    const DEFAULT_THEME: "light" | "dark" = "light";

    try {
        const stored = localStorage.getItem("theme");
        preferredTheme = stored === "dark" ? "dark" : "light";
    } catch {
        preferredTheme = DEFAULT_THEME;
    }

    window.__setPreferredTheme = function (newTheme: "light" | "dark") {
        applyTheme(newTheme);
        try {
            localStorage.setItem("theme", newTheme);
        } catch {}
    };

    applyTheme(preferredTheme);
};

// Convert to IIFE string
export const getThemeScript: string = `(${code})();`;
export const DEFAULT_THEME: "light" | "dark" = "light";
