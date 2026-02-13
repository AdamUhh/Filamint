import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { PrintService, Spool, SpoolService } from "@bindings";

import { AppContext, type AppContextValue } from "./useContext";

export function AppProvider({ children }: { children: ReactNode }) {
    const [spools, setSpools] = useState<AppContextValue["spools"]>(new Map());
    const [prints, setPrints] = useState<AppContextValue["prints"]>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [options, setOptions] = useState<AppContextValue["options"]>({
        currency: "AED",
        currencyAlign: "left",
    });

    // Load options from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("app-options");
        if (saved) {
            setOptions(JSON.parse(saved));
        }
    }, []);

    // Save options to localStorage
    useEffect(() => {
        localStorage.setItem("app-options", JSON.stringify(options));
    }, [options]);

    // Fetch spools from backend (which now uses cache)
    const fetchSpools = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Backend returns cached data, so this is fast
            const spoolResults = await SpoolService.ListSpools();
            const spoolsMap = new Map(spoolResults.map((s) => [s.id, s]));
            setSpools(spoolsMap);
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Failed to fetch spools")
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchPrints = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const printResults = await PrintService.ListPrints();
            const printsMap = new Map(printResults.map((p) => [p.id, p]));
            setPrints(printsMap);
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Failed to fetch prints")
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchSpools();
        fetchPrints();
    }, [fetchSpools, fetchPrints]);

    // Optimistic update helpers - update local state immediately
    // Backend cache is updated automatically by service methods
    const updateSpoolOptimistic = useCallback((spool: Spool) => {
        setSpools((prev) => {
            const next = new Map(prev);
            next.set(spool.id, spool);
            return next;
        });
    }, []);

    const deleteSpoolOptimistic = useCallback((id: number) => {
        setSpools((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const addSpoolOptimistic = useCallback((spool: Spool) => {
        setSpools((prev) => {
            const next = new Map(prev);
            next.set(spool.id, spool);
            return next;
        });
    }, []);

    const value = useMemo<AppContextValue>(
        () => ({
            spools,
            prints,
            isLoading,
            error,
            refreshSpools: fetchSpools,
            refreshPrints: fetchPrints,
            options,
            setOptions,
            updateSpoolOptimistic,
            deleteSpoolOptimistic,
            addSpoolOptimistic,
        }),
        [
            spools,
            prints,
            isLoading,
            error,
            fetchSpools,
            fetchPrints,
            options,
            updateSpoolOptimistic,
            deleteSpoolOptimistic,
            addSpoolOptimistic,
        ]
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
