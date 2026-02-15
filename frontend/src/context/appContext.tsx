import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
    AppContext,
    type AppContextValue,
    type AppOptions,
} from "./useContext";

export function AppProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<AppOptions>(() => {
        try {
            const saved = localStorage.getItem("app-options");
            if (saved) {
                return JSON.parse(saved) as AppOptions;
            }
        } catch (err) {
            console.error("Failed to parse saved options:", err);
        }

        return {
            currency: "AED",
            currencyAlign: "left",
        };
    });

    // Save options to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("app-options", JSON.stringify(options));
    }, [options]);

    const value = useMemo<AppContextValue>(
        () => ({
            options,
            setOptions,
        }),
        [options]
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
