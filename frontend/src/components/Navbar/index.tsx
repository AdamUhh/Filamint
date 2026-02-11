// components/BottomNav.tsx
import { LayersIcon, PrinterIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/tooltip";

import { AppSettings } from "./Settings";

export function Navbar() {
    const [settingsOpen, setSettingsOpen] = useState(false);

    const navItem =
        "relative flex min-w-16 hover:cursor-pointer flex-col items-center justify-center gap-0.5 hover:text-2xs px-3 py-1.5 font-medium transition-colors duration-300";

    const activeItem = "text-primary";
    const inactiveItem = "text-muted-foreground hover:text-foreground";

    const iconItem =
        "size-3 transition-transform duration-200 group-hover:scale-110";

    return (
        <>
            <div className="group fixed bottom-4 left-1/2 z-50 -translate-x-1/2 text-[8px] transition-transform duration-300 hover:scale-115">
                <div className="flex items-center rounded-full border bg-background/85 px-2 py-1 shadow-sm backdrop-blur-md">
                    <Tooltip>
                        <TooltipTrigger>
                            <NavLink
                                to="/spools"
                                className={({ isActive }) =>
                                    `group ${navItem} ${
                                        isActive ? activeItem : inactiveItem
                                    }`
                                }
                            >
                                <LayersIcon className={iconItem} />
                                <span>Spools</span>
                            </NavLink>
                        </TooltipTrigger>
                        <TooltipContent>Ctrl + Shift + S</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger>
                            <NavLink
                                to="/prints"
                                className={({ isActive }) =>
                                    `group ${navItem} ${
                                        isActive ? activeItem : inactiveItem
                                    }`
                                }
                            >
                                <PrinterIcon className={iconItem} />
                                <span>Prints</span>
                            </NavLink>
                        </TooltipTrigger>
                        <TooltipContent>Ctrl + Shift + P</TooltipContent>
                    </Tooltip>

                    <button
                        onClick={() => setSettingsOpen(true)}
                        className={`group ${navItem} ${inactiveItem}`}
                    >
                        <SettingsIcon className={iconItem} />
                        <span>Settings</span>
                    </button>
                </div>
            </div>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-scroll p-6 sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Settings</DialogTitle>
                    </DialogHeader>
                    <div>
                        <AppSettings />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
