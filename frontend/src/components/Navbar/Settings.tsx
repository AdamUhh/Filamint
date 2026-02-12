import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { ShortcutsSettings } from "./ShortcutSettings";

export function AppSettings() {
    return (
        <div className="space-y-6">
            <CurrencySettings />
            <Separator />
            <ShortcutsSettings />
        </div>
    );
}
