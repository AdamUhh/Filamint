import { useApp } from "@/context/useContext";
import { LayersIcon, PrinterIcon, SettingsIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router";

import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";

import { AppSettings } from "@/components/Settings";

import { useKeyCombo } from "@/hooks/useKeyCombo";

const navItem =
    "relative flex min-w-16 hover:cursor-pointer flex-col items-center justify-center gap-0.5  px-3 py-1.5 font-medium transition-colors duration-300";

const activeItem = "text-primary";
const inactiveItem = "text-muted-foreground hover:text-foreground";

const iconItem =
    "size-3 transition-transform duration-200 group-hover:scale-110";

export function Navbar() {
    const { openSettings } = useApp();

    const location = useLocation();

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
                        icon={LayersIcon}
                    />
                    <NavbarLink
                        href="/prints"
                        action="print:redirect"
                        name="prints"
                        icon={PrinterIcon}
                    />

                    <button
                        onClick={openSettings}
                        className={`${navItem} ${inactiveItem}`}
                    >
                        <SettingsIcon className={iconItem} />
                        <span>Settings</span>
                    </button>
                </div>
            </div>

            <AppSettings />
        </>
    );
}

function NavbarLink({
    href,
    name,
    action,
    icon: Icon,
}: {
    href: string;
    name: string;
    action: string;
    icon: React.ComponentType<{ className?: string }>;
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
                    <Icon className={iconItem} />
                    <span className="capitalize">{name}</span>
                </NavLink>
            </div>
        </LazyTooltip>
    );
}
