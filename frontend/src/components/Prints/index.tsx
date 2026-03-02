import { useKeyCombo } from "@/hooks/useKeyCombo";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import { Separator } from "@/shadcn/separator";

import { AppPagination } from "@/components/Pagination";
import {
    DeletePrintDialog,
    type DeleteState,
} from "@/components/Prints/DeleteDialog";
import { PrintFormDialog } from "@/components/Prints/Form";
import { PrintTable } from "@/components/Prints/PrintTable";
import { PAGE_SIZE } from "@/components/Prints/lib/defaults";
import {
    useDeletePrint,
    usePrintEvents,
    usePrints,
} from "@/components/Prints/lib/fetch-hooks";
import { AppSearch } from "@/components/Search";

import type { PrintQueryParams } from "@bindings";

import type { EditState } from "./lib/types";

export function PrintsPage() {
    const [queryParams, setQueryParams] = useState<PrintQueryParams>({
        search: "",
        sortBy: "date_printed",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
    });

    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });

    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);

    const { prints, total, isFetching } = usePrints(queryParams);

    const deleteMutation = useDeletePrint();

    const handleSearch = (searchTerm: string) => {
        setQueryParams((prev) => ({
            ...prev,
            search: searchTerm,
            offset: 0,
        }));
    };

    const handleSort = (column: string) => {
        setQueryParams((prev) => ({
            ...prev,
            sortBy: column,
            sortOrder:
                prev.sortBy === column && prev.sortOrder === "desc"
                    ? "asc"
                    : "desc",
        }));
    };

    const handlePageChange = (page: number) => {
        setQueryParams((prev) => ({
            ...prev,
            offset: (page - 1) * PAGE_SIZE,
        }));
    };

    const currentPage =
        Math.floor(
            (queryParams.offset || 0) / (queryParams.limit || PAGE_SIZE)
        ) + 1;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const handleCreate = () => {
        setEditState({ isOpen: true, id: 0, original: null });
    };

    usePrintEvents(handleCreate);

    const handleDeleteConfirm = async () => {
        if (!deleteIntent) return;

        try {
            await deleteMutation.mutateAsync({
                id: deleteIntent.printId,
                restoreSpoolGrams: deleteIntent.restoreSpoolGrams,
            });
        } catch (error) {
            console.error("Failed to delete print:", error);
            // TODO: Show error toast
        } finally {
            setDeleteIntent(null);
        }
    };

    return (
        <div className="space-y-6 p-6">
            <PrintHeader onCreate={handleCreate} />

            <div className="flex items-center justify-between">
                <div className="flex w-full gap-2">
                    <AppSearch
                        onSearch={handleSearch}
                        placeholder="Search prints by name or status"
                        qualifierKeys={["name", "spool", "status"]}
                        tooltipContent={
                            <div className="space-y-1 tracking-wide">
                                <p className="font-medium">
                                    Filter with qualifiers:
                                </p>
                                <p>name: spool: status:</p>

                                <Separator className="bg-muted-foreground" />

                                <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
                                    <span className="font-medium">
                                        Wildcards:
                                    </span>
                                    <span>name:"Print A"</span>

                                    <span className="font-medium">Quotes:</span>
                                    <span>spool:PLA-*</span>

                                    <span className="font-medium">
                                        Mix freely:
                                    </span>
                                    <span>
                                        Print spool:PLA* status:completed
                                    </span>
                                </div>

                                <p className="text-xs text-background/70">
                                    Status: Completed | Failed | Cancelled
                                </p>
                                <p className="text-xs text-background/70">
                                    Wildcards and quotes only work inside
                                    qualifiers.
                                </p>
                            </div>
                        }
                    />
                    <div className="mt-2 text-xs text-muted-foreground">
                        {isFetching
                            ? "Loading prints..."
                            : `Showing ${prints.size} of ${total} prints${
                                  queryParams.search
                                      ? ` matching "${queryParams.search}"`
                                      : ""
                              }`}
                    </div>
                </div>
            </div>

            <AppPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

            <PrintTable
                isLoading={isFetching}
                prints={prints}
                onEdit={(print) =>
                    setEditState({
                        id: print.id,
                        isOpen: true,
                        original: print,
                    })
                }
                onDuplicate={(print) =>
                    setEditState({
                        id: 0,
                        isOpen: true,
                        original: print,
                    })
                }
                onDelete={(printId) =>
                    setDeleteIntent({ printId, restoreSpoolGrams: true })
                }
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder as "asc" | "desc"}
                onSort={handleSort}
            />

            <PrintFormDialog
                editState={editState}
                setEditState={setEditState}
            />

            {deleteIntent && (
                <DeletePrintDialog
                    intent={deleteIntent}
                    onIntentChange={setDeleteIntent}
                    onConfirm={handleDeleteConfirm}
                />
            )}
        </div>
    );
}

function PrintHeader({ onCreate }: { onCreate: () => void }) {
    const keyCombo = useKeyCombo("print:create");

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <h1 className="text-3xl font-bold">Prints</h1>
                <p className="text-muted-foreground">
                    This is where your prints live.
                </p>
            </div>

            <LazyTooltip content={keyCombo}>
                <Button onClick={onCreate}>
                    <PlusIcon /> Add Print
                </Button>
            </LazyTooltip>
        </div>
    );
}
