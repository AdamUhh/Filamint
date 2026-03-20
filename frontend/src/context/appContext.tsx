import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    DEFAULT_LINUX_OPEN_IN_APP,
    DEFAULT_MAC_OPEN_IN_APP,
    DEFAULT_OPEN_IN_APP,
    DEFAULT_SPOOL_COLORS,
    DEFAULT_SPOOL_MATERIALS,
    DEFAULT_SPOOL_MATERIALTYPES,
    DEFAULT_SPOOL_VENDORS,
} from "@/lib/constant-spools";

import {
    AppContext,
    type AppContextValue,
    type AppOptions,
} from "./useContext";

function getDefaultOpenInApp(platform?: string): AppOptions["openInApp"] {
    if (platform === "darwin") return DEFAULT_MAC_OPEN_IN_APP;
    if (platform === "linux") return DEFAULT_LINUX_OPEN_IN_APP;
    return DEFAULT_OPEN_IN_APP;
}

function detectPlatform(): AppOptions["platform"] {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "darwin";
    if (ua.includes("linux")) return "linux";
    return "windows";
}

export function AppProvider({ children }: { children: ReactNode }) {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [options, setOptions] = useState<AppOptions>(() => {
        const platform = detectPlatform();

        try {
            const saved = localStorage.getItem("app-options");
            if (saved) {
                return {
                    ...(JSON.parse(saved) as AppOptions),
                    platform, // always override with fresh detection
                };
            }
        } catch (err) {
            console.error("Failed to parse saved options:", err);
        }

        return {
            currency: "AED",
            currencyAlign: "left",
            vendors: DEFAULT_SPOOL_VENDORS,
            materials: DEFAULT_SPOOL_MATERIALS,
            materialTypes: DEFAULT_SPOOL_MATERIALTYPES,
            colors: DEFAULT_SPOOL_COLORS,
            openInApp: getDefaultOpenInApp(platform),
            platform,
        };
    });

    const openSettings = useCallback(() => setSettingsOpen(true), []);
    const closeSettings = useCallback(() => setSettingsOpen(false), []);

    // Save options to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("app-options", JSON.stringify(options));
    }, [options]);

    const value = useMemo<AppContextValue>(
        () => ({
            options,
            setOptions,
            settingsOpen,
            openSettings,
            closeSettings,
        }),
        [options, settingsOpen, openSettings, closeSettings]
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
