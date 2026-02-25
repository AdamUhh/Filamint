import { useKeyCombo } from "@/hooks/useKeyCombo";
import { PlusIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";

import { AppPagination } from "@/components/Pagination";
import {
    DeletePrintDialog,
    type DeleteState,
} from "@/components/Prints/DeleteDialog";
import { type EditState, PrintForm } from "@/components/Prints/Form";
import {
    PAGE_SIZE,
    defaultPrintValues,
} from "@/components/Prints/lib/defaults";
import {
    useCreatePrint,
    useDeletePrint,
    usePrintEvents,
    usePrints,
    useUpdatePrint,
} from "@/components/Prints/lib/fetch-hooks";
import { useAppForm } from "@/components/Prints/lib/hooks";
import { printSchema } from "@/components/Prints/lib/schema";
import { AppSearch } from "@/components/Search";

import { type Print, PrintQueryParams } from "@bindings";

import { PrintTable } from "./printTable";

export function PrintsPage() {
    const [queryParams, setQueryParams] = useState<PrintQueryParams>({
        search: "",
        sortBy: "created_at",
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

            <div className="scroll flex gap-2">
                <AppSearch
                    onSearch={handleSearch}
                    placeholder="Search prints by name or status"
                    qualifierKeys={["name", "spool", "status"]}
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

            <AppPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

            <PrintFormDialog
                prints={prints}
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

function PrintFormDialog({
    prints,
    editState,
    setEditState,
}: {
    prints: Map<number, Print>;
    editState: EditState;
    setEditState: Dispatch<SetStateAction<EditState>>;
}) {
    const createMutation = useCreatePrint();
    const updateMutation = useUpdatePrint();

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
                spools: value.spools.map((s) => ({
                    id: editState.id,
                    printId: editState.id,
                    spoolId: s.spoolId,
                    spoolCode: "NaN", // default, doesnt do anything
                    material: "NaN", // default, doesnt do anything
                    vendor: "NaN", // default, doesnt do anything
                    color: "NaN", // default, doesnt do anything
                    colorHex: "NaN", // default, doesnt do anything
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

    useEffect(() => {
        if (editState.isOpen && editState.original) {
            form.setFieldValue("name", editState.original.name, {
                dontValidate: true,
            });
            form.setFieldValue(
                "datePrinted",
                editState.id > 0
                    ? editState.original.datePrinted
                    : new Date().toISOString(),
                {
                    dontValidate: true,
                }
            );
            form.setFieldValue("notes", editState.original.notes, {
                dontValidate: true,
            });
            form.setFieldValue("status", editState.original.status, {
                dontValidate: true,
            });
            form.setFieldValue(
                "spools",
                editState.original.spools!.map((ps) => {
                    if (!ps) {
                        throw new Error(
                            `Spool not found for id ${editState.id}`
                        );
                    }
                    return {
                        gramsUsed: ps.gramsUsed,
                        spoolId: ps.id,
                        spoolCode: ps.spoolCode,
                        color: ps.color,
                        colorHex: ps.colorHex,
                        material: ps.material,
                        vendor: ps.vendor,
                    };
                }) || [],
                {
                    dontValidate: true,
                }
            );
        }
    }, [editState, form]);

    const handleClose = () => {
        form.reset();
        setEditState({ id: 0, isOpen: false, original: null });
    };

    return (
        <Dialog
            open={editState.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) handleClose();
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
                    <PrintForm form={form} editState={editState} />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
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

                <LazyTooltip content={keyCombo}>
                    <Button onClick={onCreate}>
                        <PlusIcon /> Add Print
                    </Button>
                </LazyTooltip>
            </div>

            {/* Results info with loading indicator */}
            <div className="flex items-center gap-2"></div>
        </div>
    );
}
