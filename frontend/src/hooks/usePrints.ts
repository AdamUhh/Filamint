import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PrintService } from "@bindings";
import type { Print } from "@bindings";

export interface PrintQueryParams {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
}

interface PrintQueryResult {
    prints: Print[];
    total: number;
}

/**
 * Hook to query prints with filtering, sorting, and pagination
 */
export function usePrints(params: PrintQueryParams = {}) {
    const query = useQuery({
        queryKey: ["prints", params],
        queryFn: async (): Promise<PrintQueryResult | null> => {
            const result = await PrintService.QueryPrints({
                search: params.search || "",
                status: params.status || "",
                sortBy: params.sortBy || "created_at",
                sortOrder: params.sortOrder || "desc",
                limit: params.limit || 1000,
                offset: params.offset || 0,
            });
            return result;
        },
        staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    });

    // Convert array to Map for backward compatibility
    const printsMap = new Map((query.data?.prints || []).map((p) => [p.id, p]));

    return {
        prints: printsMap,
        printsArray: query.data?.prints || [],
        total: query.data?.total || 0,
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
            // Also invalidate spools since prints affect spool usage
            queryClient.invalidateQueries({ queryKey: ["spools"] });
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

            // Invalidate spools since usage might have changed
            queryClient.invalidateQueries({ queryKey: ["spools"] });
        },
    });
}

/**
 * Hook to delete a print
 */
export function useDeletePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            restoreSpoolGrams,
        }: {
            id: number;
            restoreSpoolGrams: boolean;
        }) => PrintService.DeletePrint(id, restoreSpoolGrams),
        onSuccess: (_, { id }) => {
            // Invalidate all print queries
            queryClient.invalidateQueries({ queryKey: ["prints"] });

            // Remove the specific print from cache
            queryClient.removeQueries({
                queryKey: ["print", id],
            });

            // Invalidate spools since usage might have changed
            queryClient.invalidateQueries({ queryKey: ["spools"] });
        },
    });
}
