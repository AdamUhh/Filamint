import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { MaterialSettings } from "./MaterialSettings";
import { ShortcutsSettings } from "./ShortcutSettings";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { VendorSettings } from "./VendorSettings";

export function AppSettings() {
    return (
        <div className="space-y-6">
            <ThemeSwitcher />
            <Separator />
            <CurrencySettings />
            <Separator />
            <VendorSettings />
            <Separator />
            <MaterialSettings />
            <Separator />
            <ShortcutsSettings />
        </div>
    );
}
