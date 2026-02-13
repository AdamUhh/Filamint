// usePaginatedSpools.ts - Custom hook for pagination and filtering
import { useCallback, useEffect, useState } from "react";

import {
    type PaginatedSpools,
    type PaginationParams,
    type SpoolFilter,
    SpoolService,
} from "@bindings";

interface UsePaginatedSpoolsOptions {
    initialPageSize?: number;
    initialFilter?: SpoolFilter;
}

export function usePaginatedSpools(options: UsePaginatedSpoolsOptions = {}) {
    const { initialPageSize = 20, initialFilter = {} } = options;

    const [paginatedData, setPaginatedData] = useState<PaginatedSpools | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [filter, setFilter] = useState<SpoolFilter>(initialFilter);

    const fetchPage = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const pagination: PaginationParams = {
                page: currentPage,
                pageSize: pageSize,
            };

            const result = await SpoolService.ListSpoolsPaginated(
                filter,
                pagination
            );
            setPaginatedData(result);
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Failed to fetch spools")
            );
            setPaginatedData(null);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, pageSize, filter]);

    // Fetch whenever dependencies change
    useEffect(() => {
        fetchPage();
    }, [fetchPage]);

    const goToPage = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);

    const nextPage = useCallback(() => {
        if (paginatedData && currentPage < paginatedData.totalPages) {
            setCurrentPage((p) => p + 1);
        }
    }, [currentPage, paginatedData]);

    const previousPage = useCallback(() => {
        if (currentPage > 1) {
            setCurrentPage((p) => p - 1);
        }
    }, [currentPage]);

    const updateFilter = useCallback((newFilter: Partial<SpoolFilter>) => {
        setFilter((prev) => ({ ...prev, ...newFilter }));
        setCurrentPage(1); // Reset to first page when filter changes
    }, []);

    const clearFilter = useCallback(() => {
        setFilter({});
        setCurrentPage(1);
    }, []);

    const updatePageSize = useCallback((newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1); // Reset to first page when page size changes
    }, []);

    const refresh = useCallback(() => {
        fetchPage();
    }, [fetchPage]);

    return {
        // Data
        spools: paginatedData?.spools || [],
        total: paginatedData?.total || 0,
        currentPage,
        pageSize,
        totalPages: paginatedData?.totalPages || 0,
        filter,

        // State
        isLoading,
        error,

        // Actions
        goToPage,
        nextPage,
        previousPage,
        updateFilter,
        clearFilter,
        updatePageSize,
        refresh,
    };
}
