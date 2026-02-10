import { useApp } from "@/context/useContext";
import { Events } from "@wailsio/runtime";
import { PlusIcon } from "lucide-react";
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

import {
    DeletePrintDialog,
    type DeleteState,
} from "@/components/Prints/deleteDialog";
import { type EditState, PrintForm } from "@/components/Prints/form";
import { defaultPrintValues } from "@/components/Prints/lib/defaults";
import { useAppForm } from "@/components/Prints/lib/hooks";
import { printSchema } from "@/components/Prints/lib/schema";
import { PrintTable } from "@/components/Prints/printTable";

import { type Print, PrintService, PrintSpool } from "@bindings";

export function PrintsPage() {
    const { spools, prints, refreshPrints, isLoading } = useApp();

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
                    await PrintService.UpdatePrint(printToSave);
                } else {
                    await PrintService.CreatePrint(printToSave);
                }
                setEditState({ id: 0, isOpen: false, original: null });
                form.reset();
                refreshPrints();
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
        (print: Print) => {
            form.setFieldValue("name", print.name);
            form.setFieldValue("status", print.status);
            form.setFieldValue("notes", print.notes);
            form.setFieldValue("datePrinted", print.datePrinted);
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
            setEditState({ isOpen: true, id: print.id, original: print });
            populateFormFromPrint(print);
        },
        [populateFormFromPrint]
    );

    const handleDuplicate = useCallback(
        (print: Print) => {
            setEditState({ isOpen: true, id: 0, original: print });
            populateFormFromPrint(print);
        },
        [populateFormFromPrint]
    );

    useEffect(() => {
        Events.On("print:create", handleCreate);

        return () => {
            Events.Off("print:create");
        };
    }, [handleCreate]);

    const handleDelete = (printId: number) => {
        setDeleteIntent({ printId, restoreSpoolGrams: true });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteIntent) return;

        try {
            await PrintService.DeletePrint(
                deleteIntent.printId,
                deleteIntent.restoreSpoolGrams
            );
            refreshPrints();
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

    if (isLoading) return <p className="p-6">Loading prints...</p>;

    console.debug("errors! : ", form.state.isValid, form.state.errors);

    return (
        <div className="space-y-6 p-6">
            <PrintHeader onCreate={handleCreate} />
            <PrintTable
                prints={prints}
                spools={spools}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
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
                            <Button type="submit">
                                {editState.id > 0 ? "Update" : "Create"}
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
    return (
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
                    <p>Ctrl + N</p>
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
