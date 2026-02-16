import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { ShortcutsSettings } from "./ShortcutSettings";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function AppSettings() {
    return (
        <div className="space-y-6">
            <CurrencySettings />
            <Separator />
            <ThemeSwitcher />
            <Separator />
            <ShortcutsSettings />
        </div>
    );
}
