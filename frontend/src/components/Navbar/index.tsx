import { Events } from "@wailsio/runtime";
import { LayersIcon, PrinterIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";
import { useLocation } from "react-router";

import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";

import { AppSettings } from "@/components/Settings";

import { useKeyCombo } from "@/hooks/useKeyCombo";

const navItem =
    "relative flex min-w-16 hover:cursor-pointer flex-col items-center justify-center gap-0.5  px-3 py-1.5 font-medium transition-colors duration-300";

const activeItem = "text-primary";
const inactiveItem = "text-muted-foreground hover:text-foreground";

const iconItem =
    "size-3 transition-transform duration-200 group-hover:scale-110";

export function Navbar() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const location = useLocation();

    const handleDialogChange = (open: boolean) => {
        setSettingsOpen(open);
        Events.Emit("shortcuts:set_enabled", !open);
    };

    // Hide navbar on /viewer routes
    if (location.pathname.startsWith("/viewer")) {
        return null;
    }

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
                        className={`${navItem} ${inactiveItem}`}
                    >
                        <SettingsIcon className={iconItem} />
                        <span>Settings</span>
                    </button>
                </div>
            </div>

            <Dialog open={settingsOpen} onOpenChange={handleDialogChange}>
                <DialogContent className="px-0 py-6 sm:max-w-4xl">
                    <DialogHeader className="px-6">
                        <DialogTitle>Settings</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[85vh] overflow-y-scroll px-6 [&::-webkit-scrollbar]:w-2">
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

    return (
        <LazyTooltip content={comboKey}>
            <div>
                <NavLink
                    to={href}
                    className={({ isActive }) =>
                        `group ${navItem} ${isActive ? activeItem : inactiveItem}`
                    }
                >
                    {name === "spools" ? (
                        <LayersIcon className={iconItem} />
                    ) : (
                        <PrinterIcon className={iconItem} />
                    )}
                    <span className="capitalize">{name}</span>
                </NavLink>
            </div>
        </LazyTooltip>
    );
}
