import { type Dispatch, type SetStateAction, useEffect } from "react";

import { Button } from "@/shadcn/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";

import { PrintForm } from "@/components/Prints/FormFields";
import { defaultPrintValues } from "@/components/Prints/lib/defaults";
import {
    useCreatePrint,
    useUpdatePrint,
} from "@/components/Prints/lib/fetch-hooks";
import { useAppForm } from "@/components/Prints/lib/hooks";
import { printSchema } from "@/components/Prints/lib/schema";

import { type Print } from "@bindings";

import type { EditState } from "./lib/types";

export function PrintFormDialog({
    editState,
    setEditState,
}: {
    editState: EditState;
    setEditState: Dispatch<SetStateAction<EditState>>;
}) {
    const createMutation = useCreatePrint();
    const updateMutation = useUpdatePrint();

    const form = useAppForm({
        defaultValues: defaultPrintValues,
        validators: { onChange: printSchema },
        onSubmit: async ({ value }) => {
            const printToSave: Print = {
                id: editState.id,
                name: value.name,
                status: value.status,
                notes: value.notes,
                datePrinted: new Date(value.datePrinted),
                createdAt: null,
                updatedAt: null,
                spools: value.spools.map((s) => ({
                    printId: editState.id,
                    spoolId: s.spoolId,
                    gramsUsed: s.gramsUsed,
                    id: editState.id, // placeholder, ignored by db
                    spoolCode: "NaN", // placeholder, ignored by db
                    material: "NaN", // placeholder
                    vendor: "NaN", // placeholder
                    color: "NaN", // placeholder
                    colorHex: "NaN", // placeholder
                    createdAt: null, // placeholder
                    updatedAt: null, // placeholder
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
                editState.original.spools?.map((ps) => {
                    if (!ps) {
                        throw new Error(
                            `Spool not found for id ${editState.id}`
                        );
                    }
                    return {
                        gramsUsed: ps.gramsUsed,
                        spoolId: ps.spoolId,
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
