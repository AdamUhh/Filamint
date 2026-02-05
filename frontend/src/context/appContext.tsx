import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { SpoolService } from "@bindings";

import { SpoolContext, type SpoolContextValue } from "./useContext";

export function SpoolProvider({ children }: { children: ReactNode }) {
    const [spools, setSpools] = useState<SpoolContextValue["spools"]>([]);
    const [selectedSpool, setSelectedSpool] =
        useState<SpoolContextValue["selectedSpool"]>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // add handlers that saves and fetches from localstorage or DB
    const options = useMemo(
        () => ({
            currency: "AED",
            currencyAlign: "left" as const,
        }),
        []
    );

    const fetchSpools = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const result = await SpoolService.ListSpools();
            setSpools(result);
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Failed to fetch spools")
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSpools();
    }, [fetchSpools]);

    const selectSpool = useCallback(
        (spool: SpoolContextValue["spools"][number]) => {
            setSelectedSpool(spool);
        },
        []
    );

    const value = useMemo<SpoolContextValue>(
        () => ({
            spools,
            selectedSpool,
            selectSpool,
            isLoading,
            error,
            refresh: fetchSpools,
            options,
        }),
        [
            spools,
            selectedSpool,
            selectSpool,
            isLoading,
            error,
            fetchSpools,
            options,
        ]
    );

    return (
        <SpoolContext.Provider value={value}>{children}</SpoolContext.Provider>
    );
}
