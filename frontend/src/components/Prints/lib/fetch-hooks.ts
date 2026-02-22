import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { useEffect, useMemo } from "react";

import type { Print, PrintQueryParams } from "@bindings";
import { PrintService } from "@bindings";

import { PAGE_SIZE } from "./defaults";

export function usePrintEvents(onCreate: () => void) {
    useEffect(() => {
        const unsubCreate = Events.On("print:create", onCreate);

        return () => {
            unsubCreate();
        };
    }, [onCreate]);
}

/**
 * Hook to query prints with filtering, sorting, and pagination
 */
export function usePrints(params: Partial<PrintQueryParams> = {}) {
    const queryParams: PrintQueryParams = {
        search: "",
        sortBy: "updated_at",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
        ...params,
    };

    const query = useQuery({
        queryKey: ["prints", queryParams],
        queryFn: () => PrintService.QueryPrints(queryParams),
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    const printsMap = useMemo(
        () => new Map((query.data?.prints ?? []).map((s) => [s.id, s])),
        [query.data?.prints]
    );

    return {
        prints: printsMap,
        printsArray: query.data?.prints ?? [],
        total: query.data?.total ?? 0,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook to get a single print by ID
 */
export function usePrint(id: number) {
    return useQuery({
        queryKey: ["print", id],
        queryFn: async () => {
            if (!id) return null;
            return await PrintService.GetPrint(id);
        },
        enabled: id > 0,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook to create a new print
 */
export function useCreatePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (print: Print) => PrintService.CreatePrint(print),
        onSuccess: () => {
            // Invalidate all print queries to refetch with current filters
            queryClient.invalidateQueries({ queryKey: ["prints"] });
        },
    });
}

/**
 * Hook to update an existing print
 */
export function useUpdatePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (print: Print) => PrintService.UpdatePrint(print),
        onSuccess: (_, updatedPrint) => {
            // Invalidate all print queries
            queryClient.invalidateQueries({ queryKey: ["prints"] });

            // Also invalidate the specific print query
            queryClient.invalidateQueries({
                queryKey: ["print", updatedPrint.id],
            });
        },
    });
}

/**
 * Hook to delete a print
 */
export function useDeletePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (args: { id: number; restoreSpoolGrams: boolean }) =>
            PrintService.DeletePrint(args.id, args.restoreSpoolGrams),
        onSuccess: (_, deletedId) => {
            // Invalidate all print queries
            queryClient.invalidateQueries({ queryKey: ["prints"] });

            // Remove the specific print from cache
            queryClient.removeQueries({
                queryKey: ["print", deletedId],
            });
        },
    });
}

// interface PrintQueryResult {
//     prints: Print[];
//     total: number;
// }

/**
 * Hook for optimistic updates (optional - use if you want instant UI updates)
 */
// export function useOptimisticUpdatePrint() {
//     const queryClient = useQueryClient();
//
//     return useMutation({
//         mutationFn: (print: Print) => PrintService.UpdatePrint(print),
//
//         // Optimistically update the UI before the server responds
//         onMutate: async (updatedPrint) => {
//             // Cancel outgoing refetches
//             await queryClient.cancelQueries({ queryKey: ["prints"] });
//
//             // Snapshot the previous value
//             const previousPrints = queryClient.getQueryData(["prints"]);
//
//             // Optimistically update cache
//             queryClient.setQueriesData(
//                 { queryKey: ["prints"] },
//                 (old: PrintQueryResult | undefined) => {
//                     if (!old) return old;
//                     return {
//                         ...old,
//                         prints: old.prints.map((s) =>
//                             s.id === updatedPrint.id ? updatedPrint : s
//                         ),
//                     };
//                 }
//             );
//
//             return { previousPrints };
//         },
//
//         // If mutation fails, rollback
//         onError: (_err, _updatedPrint, context) => {
//             if (context?.previousPrints) {
//                 queryClient.setQueryData(["prints"], context.previousPrints);
//             }
//         },
//
//         // Always refetch after error or success
//         onSettled: () => {
//             queryClient.invalidateQueries({ queryKey: ["prints"] });
//         },
//     });
// }
