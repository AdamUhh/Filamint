import { useKeyCombo } from "@/hooks/useKeyCombo";
import {
    type PrintQueryParams,
    useCreatePrint,
    useDeletePrint,
    usePrints,
    useUpdatePrint,
} from "@/hooks/usePrints";
import { useSpools } from "@/hooks/useSpools";
import { Events } from "@wailsio/runtime";
import { PlusIcon, RotateCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/tooltip";

import { SpoolPagination } from "@/components/Pagination";
import {
    DeletePrintDialog,
    type DeleteState,
} from "@/components/Prints/deleteDialog";
import { type EditState, PrintForm } from "@/components/Prints/form";
import { defaultPrintValues } from "@/components/Prints/lib/defaults";
import { useAppForm } from "@/components/Prints/lib/hooks";
import { printSchema } from "@/components/Prints/lib/schema";
import { PrintTable } from "@/components/Prints/printTable";
import { SpoolSearch } from "@/components/Search";

import { type Print, PrintSpool } from "@bindings";

const PAGE_SIZE = 20;

export function PrintsPage() {
    const [queryParams, setQueryParams] = useState<PrintQueryParams>({
        search: "",
        sortBy: "created_at",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
    });

    const { prints, total, isFetching } = usePrints(queryParams);
    const { spools } = useSpools();
    const createMutation = useCreatePrint();
    const updateMutation = useUpdatePrint();
    const deleteMutation = useDeletePrint();

    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });
    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);

    const form = useAppForm({
        defaultValues: defaultPrintValues,
        validators: { onChange: printSchema },
        onSubmit: async ({ value }) => {
            const now = new Date().toISOString();
            const printToSave: Print = {
                id: editState.id,
                name: value.name,
                status: value.status,
                notes: value.notes,
                datePrinted: new Date(value.datePrinted),
                createdAt:
                    editState.id > 0
                        ? prints.get(editState.id)?.createdAt || now
                        : now,
                updatedAt: now,
                spools: (value.spools as PrintSpool[]).map((s) => ({
                    id: editState.id,
                    printId: editState.id,
                    spoolId: s.spool!.id,
                    gramsUsed: s.gramsUsed,
                    createdAt:
                        editState.id > 0
                            ? prints.get(editState.id)?.createdAt || now
                            : now,
                    updatedAt: now,
                })),
            };

            try {
                if (editState.id > 0) {
                    await updateMutation.mutateAsync(printToSave);
                } else {
                    await createMutation.mutateAsync(printToSave);
                }
                setEditState({ id: 0, isOpen: false, original: null });
                form.reset();
            } catch (err) {
                console.error("Failed to save print:", err);
            }
        },
    });

    const handleCreate = useCallback(() => {
        setEditState({ isOpen: true, id: 0, original: null });
        form.reset();
    }, [form]);

    const populateFormFromPrint = useCallback(
        (print: Print, isDuplicate = false) => {
            form.setFieldValue("name", print.name);
            form.setFieldValue("status", print.status);
            form.setFieldValue("notes", print.notes);
            form.setFieldValue(
                "datePrinted",
                isDuplicate ? new Date().toISOString() : print.datePrinted
            );
            form.setFieldValue(
                "spools",
                print.spools!.map((ps) => {
                    const spool = spools.get(ps.spoolId);
                    if (!spool) {
                        throw new Error(`Spool not found for id ${ps.spoolId}`);
                    }
                    return {
                        gramsUsed: ps.gramsUsed,
                        spool: {
                            id: spool.id,
                            spoolCode: spool.spoolCode,
                            color: spool.color,
                            material: spool.material,
                            vendor: spool.vendor,
                        },
                    };
                })
            );
        },
        [form, spools]
    );

    const handleEdit = useCallback(
        (print: Print) => {
            form.reset();
            setEditState({ isOpen: true, id: print.id, original: print });
            populateFormFromPrint(print);
        },
        [form, populateFormFromPrint]
    );

    const handleDuplicate = useCallback(
        (print: Print) => {
            form.reset();
            setEditState({ isOpen: true, id: 0, original: print });
            populateFormFromPrint(print, true);
        },
        [form, populateFormFromPrint]
    );

    useEffect(() => {
        const unsubscribe = Events.On("print:create", handleCreate);

        return () => {
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = (printId: number) => {
        setDeleteIntent({ printId, restoreSpoolGrams: true });
    };

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

    const handleCloseDialog = useCallback(() => {
        form.reset();
        setEditState({ id: 0, isOpen: false, original: null });
    }, [form]);

    const handleSearch = useCallback((searchTerm: string) => {
        setQueryParams((prev) => ({
            ...prev,
            search: searchTerm,
            offset: 0, // Reset to first page on search
        }));
    }, []);

    const handleSort = useCallback((column: string) => {
        setQueryParams((prev) => ({
            ...prev,
            sortBy: column,
            sortOrder:
                prev.sortBy === column && prev.sortOrder === "desc"
                    ? "asc"
                    : "desc",
        }));
    }, []);

    const handlePageChange = useCallback((page: number) => {
        setQueryParams((prev) => ({
            ...prev,
            offset: (page - 1) * PAGE_SIZE,
        }));
    }, []);

    const currentPage =
        Math.floor(
            (queryParams.offset || 0) / (queryParams.limit || PAGE_SIZE)
        ) + 1;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    console.debug("errors! : ", form.state.isValid, form.state.errors);

    return (
        <div className="space-y-6 p-6">
            <PrintHeader onCreate={handleCreate} />

            <div className="flex items-center gap-2">
                <SpoolSearch
                    onSearch={handleSearch}
                    // TODO: search by code as well
                    placeholder="Search prints by name or status"
                />
                {isFetching ? (
                    <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                        <RotateCwIcon className="size-3 animate-spin" />
                        <span>Loading prints...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <p>
                            Showing {prints.size} of {total} prints
                            {queryParams.search &&
                                ` matching "${queryParams.search}"`}
                        </p>
                    </div>
                )}
            </div>

            <PrintTable
                isLoading={isFetching}
                prints={prints}
                spools={spools}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder}
                onSort={handleSort}
            />

            <SpoolPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

            <Dialog
                open={editState.isOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) handleCloseDialog();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editState.id > 0 ? "Edit Print" : "Add New Print"}
                        </DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                    >
                        <PrintForm
                            form={form}
                            editState={editState}
                            spools={spools}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseDialog}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    createMutation.isPending ||
                                    updateMutation.isPending
                                }
                            >
                                {createMutation.isPending ||
                                updateMutation.isPending
                                    ? "Saving..."
                                    : editState.id > 0
                                      ? "Update"
                                      : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold">Prints</h1>
                    <p className="text-muted-foreground">
                        This is where your prints live.
                    </p>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={onCreate}>
                            <PlusIcon /> Add Print
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{keyCombo}</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Results info with loading indicator */}
            <div className="flex items-center gap-2"></div>
        </div>
    );
}
