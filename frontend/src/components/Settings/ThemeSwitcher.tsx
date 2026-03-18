import { Label } from "@/shadcn/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import { THEMES, type Theme } from "@/lib/constant-theme";

import { useThemeSettings } from "@/hooks/useTheme";

export function ThemeSwitcher() {
    const { theme, setTheme } = useThemeSettings();

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">Theme</h2>
                <p className="text-sm text-muted-foreground">
                    Select your color scheme.
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
                    <SelectTrigger id="theme" className="w-45 capitalize">
                        <SelectValue placeholder="Select theme" />
                    </SelectTrigger>

                    <SelectContent>
                        {THEMES.map((value) => (
                            <SelectItem
                                key={value}
                                value={value}
                                className="capitalize"
                            >
                                {value}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </section>
    );
}
