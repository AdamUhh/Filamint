import { useApp } from "@/context/useContext";
import { Events } from "@wailsio/runtime";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";
import { Separator } from "@/shadcn/separator";

import { CurrencySettings } from "./CurrencySettings";
import { FileDirLocation } from "./FileDirLocation";
import { OpenInAppSettings } from "./OpenInAppSettings";
import { ShortcutsSettings } from "./ShortcutSettings";
import { DefaultSpoolSettings } from "./SpoolDefaultSettings";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UpdateSettings } from "./UpdateSettings";

export function AppSettings() {
    const { settingsOpen, closeSettings } = useApp();

    const handleOpenChange = (open: boolean) => {
        if (!open) closeSettings();
        Events.Emit("shortcuts:set_enabled", open);
    };

    return (
        <Dialog open={settingsOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="px-0 py-6 sm:max-w-4xl">
                <DialogHeader className="px-6">
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="max-h-[85vh] overflow-y-scroll px-6 [&::-webkit-scrollbar]:w-2">
                    <div className="space-y-6">
                        <UpdateSettings />
                        <div className="flex gap-4">
                            <ThemeSwitcher />
                            <Separator
                                orientation="vertical"
                                className="mx-auto"
                            />
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
