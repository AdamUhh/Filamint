import { useKeyCombo } from "@/hooks/useKeyCombo";
import { Events } from "@wailsio/runtime";
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

const navItem =
    "relative flex min-w-16 hover:cursor-pointer flex-col items-center justify-center gap-0.5  px-3 py-1.5 font-medium transition-colors duration-300";

const activeItem = "text-primary";
const inactiveItem = "text-muted-foreground hover:text-foreground";

const iconItem =
    "size-3 transition-transform duration-200 group-hover:scale-110";

export function Navbar() {
    const [settingsOpen, setSettingsOpen] = useState(false);

    const handleDialogChange = (open: boolean) => {
        setSettingsOpen(open);
        Events.Emit("shortcuts:set_enabled", !open);
    };

    return (
        <>
            <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 text-[8px] transition-transform duration-300 hover:scale-115">
                <div className="flex items-center rounded-full border bg-background/85 px-2 py-1 shadow-sm backdrop-blur-md">
                    <NavbarLink
                        href="/spools"
                        action="spool:redirect"
                        name="spools"
                    />
                    <NavbarLink
                        href="/prints"
                        action="print:redirect"
                        name="prints"
                    />

                    <button
                        onClick={() => handleDialogChange(true)}
                        className={` ${navItem} ${inactiveItem}`}
                    >
                        <SettingsIcon className={iconItem} />
                        <span>Settings</span>
                    </button>
                </div>
            </div>

            <Dialog open={settingsOpen} onOpenChange={handleDialogChange}>
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

function NavbarLink({
    href,
    name,
    action,
}: {
    href: string;
    name: string;
    action: string;
}) {
    const comboKey = useKeyCombo(action);
    console.debug("test", comboKey);

    return (
        <Tooltip>
            <TooltipTrigger>
                <NavLink
                    to={href}
                    className={({ isActive }) =>
                        `group ${navItem} ${
                            isActive ? activeItem : inactiveItem
                        }`
                    }
                >
                    {name === "spools" ? (
                        <LayersIcon className={iconItem} />
                    ) : (
                        <PrinterIcon className={iconItem} />
                    )}
                    <span className="capitalize">{name}</span>
                </NavLink>
            </TooltipTrigger>
            <TooltipContent>{comboKey}</TooltipContent>
        </Tooltip>
    );
}
