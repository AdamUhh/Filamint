import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { FileDirLocation } from "./FileDirLocation";
import { DefaultSpoolSettings } from "./SpoolDefaultSettings";
import { OpenInAppSettings } from "./OpenInAppSettings";
import { ShortcutsSettings } from "./ShortcutSettings";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UpdateSettings } from "./UpdateSettings";

export function AppSettings() {
    return (
        <div className="space-y-6">
            <UpdateSettings />
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
