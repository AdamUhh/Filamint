import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { useEffect, useMemo } from "react";

import type { Spool, SpoolQueryParams } from "@bindings";
import { SpoolService } from "@bindings";

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

/**
 * Hook to query spools with filtering, sorting, and pagination
 */
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

/**
 * Hook to get a single spool by ID
 */
export function useSpool(id: number) {
    return useQuery({
        queryKey: ["spool", id],
        queryFn: async () => {
            if (!id) return null;
            return await SpoolService.GetSpool(id);
        },
        enabled: id > 0,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook to create a new spool
 */
export function useCreateSpool() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (spool: Spool) => SpoolService.CreateSpool(spool),
        onSuccess: () => {
            // Invalidate all spool queries to refetch with current filters
            queryClient.invalidateQueries({ queryKey: ["spools"] });
        },
    });
}

/**
 * Hook to update an existing spool
 */
export function useUpdateSpool() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (spool: Spool) => SpoolService.UpdateSpool(spool),
        onSuccess: (_, updatedSpool) => {
            // Invalidate all spool queries
            queryClient.invalidateQueries({ queryKey: ["spools"] });

            // Also invalidate the specific spool query
            queryClient.invalidateQueries({
                queryKey: ["spool", updatedSpool.id],
            });
        },
    });
}

/**
 * Hook to delete a spool
 */
export function useDeleteSpool() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => SpoolService.DeleteSpool(id),
        onSuccess: (_, deletedId) => {
            // Invalidate all spool queries
            queryClient.invalidateQueries({ queryKey: ["spools"] });

            // Remove the specific spool from cache
            queryClient.removeQueries({
                queryKey: ["spool", deletedId],
            });
        },
    });
}

// interface SpoolQueryResult {
//     spools: Spool[];
//     total: number;
// }

/**
 * Hook for optimistic updates (optional - use if you want instant UI updates)
 */
// export function useOptimisticUpdateSpool() {
//     const queryClient = useQueryClient();
//
//     return useMutation({
//         mutationFn: (spool: Spool) => SpoolService.UpdateSpool(spool),
//
//         // Optimistically update the UI before the server responds
//         onMutate: async (updatedSpool) => {
//             // Cancel outgoing refetches
//             await queryClient.cancelQueries({ queryKey: ["spools"] });
//
//             // Snapshot the previous value
//             const previousSpools = queryClient.getQueryData(["spools"]);
//
//             // Optimistically update cache
//             queryClient.setQueriesData(
//                 { queryKey: ["spools"] },
//                 (old: SpoolQueryResult | undefined) => {
//                     if (!old) return old;
//                     return {
//                         ...old,
//                         spools: old.spools.map((s) =>
//                             s.id === updatedSpool.id ? updatedSpool : s
//                         ),
//                     };
//                 }
//             );
//
//             return { previousSpools };
//         },
//
//         // If mutation fails, rollback
//         onError: (_err, _updatedSpool, context) => {
//             if (context?.previousSpools) {
//                 queryClient.setQueryData(["spools"], context.previousSpools);
//             }
//         },
//
//         // Always refetch after error or success
//         onSettled: () => {
//             queryClient.invalidateQueries({ queryKey: ["spools"] });
//         },
//     });
// }
