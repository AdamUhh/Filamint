import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { FileDirLocation } from "./FileDirLocation";
import { DefaultSpoolSettings } from "./MaterialSettings";
import { OpenInAppSettings } from "./OpenInAppSettings";
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
            <OpenInAppSettings />
            <Separator />
            <ShortcutsSettings />
            <FileDirLocation />
        </div>
    );
}
