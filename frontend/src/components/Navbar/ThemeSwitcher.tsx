import { useThemeSettings } from "@/hooks/useTheme";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import { THEMES, type Theme } from "@/lib/constant-theme";

export function ThemeSwitcher() {
    const { theme, setTheme } = useThemeSettings();

    return (
        <section className="space-y-3">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">Theme</h2>
                <p className="text-sm text-muted-foreground">
                    Select your theme!
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Select
                    value={theme}
                    onValueChange={(value) => setTheme(value as Theme)}
                >
                    <SelectTrigger className="w-45">
                        <SelectValue placeholder="Select theme" />
                    </SelectTrigger>

                    <SelectContent>
                        {THEMES.map((value) => (
                            <SelectItem key={value} value={value}>
                                <div className="flex items-center gap-2 capitalize">
                                    {/* <Icon className="h-4 w-4 opacity-80" /> */}
                                    <span>{value}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </section>
    );
}
