import { useThemeSettings } from "@/hooks/useTheme";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/shadcn/button";

export function ThemeSwitcher() {
    const { setTheme, theme } = useThemeSettings();

    return (
        <div className="flex items-center gap-2">
            <Button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                variant="outline"
                className="relative flex h-14 w-14 items-center justify-center rounded-full p-0 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
                <SunIcon className="absolute h-5 w-5 scale-100 rotate-0 transform text-amber-500 transition-all duration-300 ease-in-out dark:scale-0 dark:-rotate-90" />
                <MoonIcon className="absolute h-5 w-5 scale-0 rotate-90 transform text-slate-700 transition-all duration-300 ease-in-out dark:scale-100 dark:rotate-0 dark:text-slate-200" />
            </Button>

            <span className="capitalize">{theme}</span>
        </div>
    );
}
