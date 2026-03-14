import { Loader2Icon } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

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
    useDeletePrintModel,
    usePrintModels,
    useUpdatePrint,
    useUploadPrintModel,
} from "@/components/Prints/lib/fetch-hooks";
import { useAppForm } from "@/components/Prints/lib/hooks";
import { type TModelSchema, printSchema } from "@/components/Prints/lib/schema";

import type { Print } from "@bindings";

import type { EditState } from "./lib/types";

export function PrintFormDialog({
    editState,
    setEditState,
}: {
    editState: EditState;
    setEditState: Dispatch<SetStateAction<EditState>>;
}) {
    const [isSaving, setIsSaving] = useState(false);

    const createMutation = useCreatePrint();
    const updateMutation = useUpdatePrint();
    const uploadModelMutation = useUploadPrintModel();
    const deleteModelMutation = useDeletePrintModel();

    const form = useAppForm({
        defaultValues: defaultPrintValues,
        validators: { onChange: printSchema },
        onSubmit: async ({ value }) => {
            const modelsToSave: TModelSchema[] = value.models;

            const filesToUpload = modelsToSave.filter(
                (m): m is File => m instanceof File
            );

            const existingModels = modelsToSave.filter(
                (m): m is TModelSchema => "id" in m
            );

            const removedModels =
                editState.original?.models?.filter(
                    (orig) =>
                        !existingModels.some(
                            (m) => "id" in m && m.id === orig.id
                        )
                ) || [];

            const printToSave: Print = {
                id: editState.id,
                name: value.name,
                status: value.status,
                notes: value.notes,
                datePrinted: new Date(value.datePrinted),
                createdAt: null, // placeholder, ignored by db
                updatedAt: null, // placeholder
                models: [],
                spools: value.spools.map((s) => ({
                    printId: editState.id,
                    spoolId: s.spoolId,
                    gramsUsed: s.gramsUsed,
                    id: editState.id, // placeholder
                    totalWeight: 0, // placeholder
                    usedWeight: 0, // placeholder
                    spoolCode: "NaN", // placeholder
                    material: "NaN", // placeholder
                    vendor: "NaN", // placeholder
                    color: "NaN", // placeholder
                    colorHex: "NaN", // placeholder
                    createdAt: null, // placeholder
                    updatedAt: null, // placeholder
                })),
            };
            setIsSaving(true);
            try {
                if (editState.id > 0) {
                    await updateMutation.mutateAsync(printToSave);

                    // 2️⃣ Upload new files sequentially
                    for (const file of filesToUpload) {
                        await uploadModelMutation.mutateAsync({
                            printId: editState.id,
                            file,
                        });
                    }

                    // 3️⃣ Delete removed models
                    for (const removed of removedModels) {
                        await deleteModelMutation.mutateAsync({
                            printId: editState.id,
                            modelId: removed.id,
                        });
                    }
                } else {
                    const printId =
                        await createMutation.mutateAsync(printToSave);

                    // 2️⃣ Upload new files sequentially
                    for (const file of filesToUpload) {
                        await uploadModelMutation.mutateAsync({
                            printId,
                            file,
                        });
                    }

                    for (const model of existingModels) {
                        await uploadModelMutation.mutateAsync({
                            printId,
                            file: model,
                        });
                    }
                }
                setEditState({ id: 0, isOpen: false, original: null });
                form.reset();
            } catch (err) {
                console.error("Failed to save print:", err);
            } finally {
                setIsSaving(false);
            }
        },
    });

    const { data } = usePrintModels(
        editState.id || editState?.original?.id || 0
    );

    useEffect(() => {
        form.setFieldValue("models", data || [], {
            dontValidate: true,
        });
        setEditState((prev) => {
            if (!prev.original) return prev;

            return {
                ...prev,
                original: {
                    ...prev.original,
                    models: data ?? [],
                },
            };
        });
    }, [data, form, setEditState]);

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
                        totalWeight: ps.totalWeight,
                        usedWeight: ps.usedWeight,
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
        } else if (editState.isOpen && editState.id === 0) {
            form.setFieldValue("datePrinted", new Date().toISOString(), {
                dontValidate: true,
            });
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
            <DialogContent className="max-h-[90vh] px-0 py-3 sm:max-w-lg">
                <DialogHeader className="px-3 pt-2">
                    <DialogTitle>
                        {editState.id > 0
                            ? "Edit Print"
                            : editState.id === 0 && editState.original
                              ? "Duplicate Print"
                              : "Add New Print"}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                >
                    <div className="max-h-[70vh] overflow-y-auto px-3">
                        <PrintForm form={form} editState={editState} />
                    </div>
                    <DialogFooter className="mx-0">
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
                            {isSaving && (
                                <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
                            )}
                            {isSaving
                                ? editState.id > 0
                                    ? "Updating..."
                                    : editState.id === 0 && editState.original
                                      ? "Duplicating..."
                                      : "Creating..."
                                : editState.id > 0
                                  ? "Update"
                                  : editState.id === 0 && editState.original
                                    ? "Duplicate"
                                    : "Create"}{" "}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
