import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { DefaultSpoolSettings } from "./MaterialSettings";
import { ShortcutsSettings } from "./ShortcutSettings";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function AppSettings() {
    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <ThemeSwitcher />
                <Separator orientation="vertical" className="mx-auto" />
                <CurrencySettings />
            </div>
            <Separator />
            <DefaultSpoolSettings />
            <Separator />
            <ShortcutsSettings />
        </div>
    );
}
