import {
    useIsFetching,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { Events } from "@wailsio/runtime";
import { useEffect, useMemo, useRef, useState } from "react";

import { type Print, type PrintQueryParams, PrintService } from "@bindings";

import { PAGE_SIZE } from "./defaults";
import type { TModelSchema } from "./schema";

export function usePrintEvents(onCreate: () => void) {
    useEffect(() => {
        const unsubCreate = Events.On("print:create", onCreate);

        return () => {
            unsubCreate();
        };
    }, [onCreate]);
}

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

export function useCreatePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (print: Print) => PrintService.CreatePrint(print),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["prints"] });
        },
    });
}

export function useUpdatePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (print: Print) => PrintService.UpdatePrint(print),
        onSuccess: (_, updatedPrint) => {
            queryClient.invalidateQueries({ queryKey: ["prints"] });

            queryClient.invalidateQueries({
                queryKey: ["print", updatedPrint.id],
            });

            queryClient.invalidateQueries({
                queryKey: ["spools"],
            });
        },
    });
}

export function useDeletePrint() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (args: { id: number; restoreSpoolGrams: boolean }) =>
            PrintService.DeletePrint(args.id, args.restoreSpoolGrams),
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ["prints"] });

            queryClient.removeQueries({
                queryKey: ["print", deletedId],
            });

            queryClient.invalidateQueries({
                queryKey: ["spools"],
            });
        },
    });
}

export function usePrintModels(id: number) {
    return useQuery({
        queryKey: ["print_models", id],
        queryFn: async () => {
            if (!id || id === 0) return null;
            return await PrintService.GetPrintModels(id);
        },
        enabled: id > 0,
    });
}

export function useUploadPrintModel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (args: { printId: number; file: TModelSchema }) => {
            const { printId, file } = args;
            const isFile = file instanceof File;

            if (!isFile) {
                return PrintService.DuplicatePrintModel(printId, file.id);
            }

            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const byteArray = Array.from(uint8Array);

            return PrintService.UploadPrintModel(
                printId,
                file.name.split(".").slice(0, -1).join("."),
                file.name.split(".").pop() || "3mf",
                file.size,
                byteArray as unknown as string
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["print_models"] });
        },
    });
}

export function useDeletePrintModel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (args: { printId: number; modelId: number }) =>
            PrintService.DeletePrintModel(args.printId, args.modelId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["print_models"] });
        },
    });
}

export function useInvalidatePrints(cooldownMs = 5000) {
    const queryClient = useQueryClient();
    const isFetching = useIsFetching({ queryKey: ["prints"] }) > 0;

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

        queryClient.invalidateQueries({ queryKey: ["prints"] });
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
