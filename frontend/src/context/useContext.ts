import { createContext, useContext } from "react";

import type { Spool } from "@bindings";

export interface SpoolContextValue {
    spools: Spool[];
    selectedSpool: Spool | null;
    isLoading: boolean;
    error: Error | null;
    options: {
        currency: string;
        currencyAlign: "left" | "right";
    };
    selectSpool: (spool: Spool) => void;
    refresh: () => Promise<void>;
}

export const SpoolContext = createContext<SpoolContextValue | undefined>(
    undefined
);

export function useSpools(): SpoolContextValue {
    const ctx = useContext(SpoolContext);
    if (!ctx) {
        throw new Error("useSpools must be used inside a SpoolProvider");
    }
    return ctx;
}
