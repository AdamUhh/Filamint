import { useThemeSettings } from "@/hooks/useTheme";

import { Label } from "@/shadcn/label";
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
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">Theme</h2>
                <p className="text-sm text-muted-foreground">
                    Select your theme!
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <Label
                    htmlFor="theme"
                    className="text-xs font-medium text-muted-foreground"
                >
                    Theme
                </Label>
                <Select
                    value={theme}
                    onValueChange={(value) => setTheme(value as Theme)}
                >
                    <SelectTrigger id="theme" className="w-45">
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
