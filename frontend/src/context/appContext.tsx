import {
    type ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { type Spool, SpoolService } from "@bindings";

interface SpoolContextValue {
    spools: Spool[];
    refresh: () => Promise<void>;
    options: { currency: string; currencyAlign: "left" | "right" };
}

const SpoolContext = createContext<SpoolContextValue | undefined>(undefined);

export function SpoolProvider({ children }: { children: ReactNode }) {
    const [spools, setSpools] = useState<Spool[]>([]);

    const fetchSpools = async () => {
        const result = await SpoolService.ListSpools();
        setSpools(result);
    };

    useEffect(() => {
        fetchSpools();
    }, []);

    return (
        <SpoolContext.Provider
            value={{
                spools,
                refresh: fetchSpools,
                options: { currency: "AED", currencyAlign: "left" },
            }}
        >
            {children}
        </SpoolContext.Provider>
    );
}

// Hook for components
export function useSpools() {
    const ctx = useContext(SpoolContext);
    if (!ctx) throw new Error("useSpools must be used inside a SpoolProvider");
    return ctx;
}
