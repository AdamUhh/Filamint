import { type Dispatch, type SetStateAction, useEffect } from "react";

import { Button } from "@/shadcn/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";

import { SpoolForm } from "@/components/Spools/FormFields";
import { defaultSpoolValues } from "@/components/Spools/lib/defaults";
import {
    useCreateSpool,
    useUpdateSpool,
} from "@/components/Spools/lib/fetch-hooks";
import { useAppForm } from "@/components/Spools/lib/hooks";
import { spoolSchema } from "@/components/Spools/lib/schema";

import type { Spool } from "@bindings";

import type { EditState } from "./lib/types";

export function SpoolFormDialog({
    editState,
    setEditState,
}: {
    editState: EditState;
    setEditState: Dispatch<SetStateAction<EditState>>;
}) {
    const createMutation = useCreateSpool();
    const updateMutation = useUpdateSpool();

    const form = useAppForm({
        defaultValues: defaultSpoolValues,
        validators: { onChange: spoolSchema },
        onSubmit: async ({ value }) => {
            const spoolToSave: Spool = {
                id: editState.id,
                spoolCode: String(editState.id),
                ...value,
                firstUsedAt: null, // placeholder, ignored by db
                lastUsedAt: null, // placeholder
                createdAt: null, // placeholder
                updatedAt: null, // placeholder
            };

            if (editState.id > 0) {
                await updateMutation.mutateAsync(spoolToSave);
            } else {
                await createMutation.mutateAsync(spoolToSave);
            }

            form.reset();
            setEditState({ id: 0, isOpen: false, original: null });
        },
    });

    useEffect(() => {
        if (editState.isOpen && editState.original) {
            form.setFieldValue("vendor", editState.original.vendor, {
                dontValidate: true,
            });
            form.setFieldValue("usedWeight", editState.original.usedWeight, {
                dontValidate: true,
            });
            form.setFieldValue("cost", editState.original.cost, {
                dontValidate: true,
            });
            form.setFieldValue(
                "referenceLink",
                editState.original.referenceLink,
                { dontValidate: true }
            );
            form.setFieldValue("notes", editState.original.notes, {
                dontValidate: true,
            });
            form.setFieldValue("totalWeight", editState.original.totalWeight, {
                dontValidate: true,
            });
            form.setFieldValue("color", editState.original.color, {
                dontValidate: true,
            });
            form.setFieldValue("colorHex", editState.original.colorHex, {
                dontValidate: true,
            });
            form.setFieldValue("material", editState.original.material, {
                dontValidate: true,
            });
            form.setFieldValue(
                "materialType",
                editState.original.materialType,
                { dontValidate: true }
            );
            form.setFieldValue("isTemplate", editState.original.isTemplate, {
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {editState.id > 0 ? "Edit Spool" : "Add New Spool"}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                >
                    <SpoolForm form={form} editState={editState} />

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
                            {editState.id > 0 ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
