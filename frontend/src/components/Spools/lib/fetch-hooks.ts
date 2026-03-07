import {
    useIsFetching,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { useEffect, useMemo, useRef, useState } from "react";

import { type Spool, type SpoolQueryParams, SpoolService } from "@bindings";

import { PAGE_SIZE } from "./defaults";

export function useSpoolEvents(
    onCreate: () => void,
    onToggleTemplate: () => void
) {
    useEffect(() => {
        const unsubCreate = Events.On("spool:create", onCreate);
        const unsubToggle = Events.On(
            "spool:toggle_template",
            onToggleTemplate
        );

        return () => {
            unsubCreate();
            unsubToggle();
        };
    }, [onCreate, onToggleTemplate]);
}

export function useSpools(params: Partial<SpoolQueryParams> = {}) {
    const queryParams: SpoolQueryParams = {
        search: "",
        isTemplate: false,
        sortBy: "updated_at",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
        ...params,
    };

    const query = useQuery({
        queryKey: ["spools", queryParams],
        queryFn: () => SpoolService.QuerySpools(queryParams),
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    const spoolsMap = useMemo(
        () => new Map((query.data?.spools ?? []).map((s) => [s.id, s])),
        [query.data?.spools]
    );

    return {
        spools: spoolsMap,
        spoolsArray: query.data?.spools ?? [],
        total: query.data?.total ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
    };
}

export function useSpool(id?: number) {
    return useQuery({
        queryKey: ["spool", id],
        queryFn: async () => {
            if (!id) return null;
            return await SpoolService.GetSpoolById(id);
        },
        enabled: !!id && id > 0,
        staleTime: 5 * 60 * 1000,
    });
}

export function useSpoolPrints(id: number) {
    return useQuery({
        queryKey: ["spool_prints", id],
        queryFn: async () => {
            if (!id) return null;
            return await SpoolService.GetSpoolPrints(id);
        },
        enabled: id > 0,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateSpool() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (spool: Spool) => SpoolService.CreateSpool(spool),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["spools"] });
        },
    });
}

export function useUpdateSpool() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (spool: Spool) => SpoolService.UpdateSpool(spool),
        onSuccess: (_, updatedSpool) => {
            queryClient.invalidateQueries({ queryKey: ["spools"] });

            queryClient.invalidateQueries({
                queryKey: ["spool", updatedSpool.id],
            });
        },
    });
}

export function useDeleteSpool() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => SpoolService.DeleteSpool(id),
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ["spools"] });

            queryClient.removeQueries({
                queryKey: ["spool", deletedId],
            });
        },
    });
}

export function useInvalidateSpools(cooldownMs = 5000) {
    const queryClient = useQueryClient();
    const isFetching = useIsFetching({ queryKey: ["spools"] }) > 0;

    const [secondsLeft, setSecondsLeft] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intervalRef = useRef<any>(null);

    const startCooldown = () => {
        const totalSeconds = Math.ceil(cooldownMs / 1000);
        setSecondsLeft(totalSeconds);

        intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const invalidate = () => {
        if (isFetching) return;
        if (secondsLeft > 0) return;

        queryClient.invalidateQueries({ queryKey: ["spools"] });
        startCooldown();
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return {
        invalidate,
        isFetching,
        secondsLeft,
        isCoolingDown: secondsLeft > 0,
    };
}
