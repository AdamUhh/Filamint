import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { PrintService, SpoolService } from "@bindings";

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

    useEffect(() => {
        const saved = localStorage.getItem("app-options");
        if (saved) {
            setOptions(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("app-options", JSON.stringify(options));
    }, [options]);

    const fetchSpools = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

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

    useEffect(() => {
        fetchSpools();
        fetchPrints();
    }, [fetchSpools, fetchPrints]);

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
        }),
        [spools, prints, isLoading, error, fetchSpools, fetchPrints, options]
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
