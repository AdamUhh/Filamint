import { createContext, useContext } from "react";

import type { Print, Spool } from "@bindings";

export interface AppContextValue {
    spools: Map<number, Spool>;
    prints: Map<number, Print>;

    isLoading: boolean;
    error: Error | null;

    options: {
        currency: string;
        currencyAlign: "left" | "right";
    };

    refreshSpools: () => Promise<void>;
    refreshPrints: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export function useApp(): AppContextValue {
    const ctx = useContext(AppContext);
    if (!ctx) {
        throw new Error("useApp must be used inside a AppProvider");
    }
    return ctx;
}
