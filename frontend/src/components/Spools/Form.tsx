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
            form.reset({
                vendor: editState.original.vendor,
                usedWeight: editState.original.usedWeight,
                cost: editState.original.cost,
                referenceLink: editState.original.referenceLink,
                notes: editState.original.notes,
                totalWeight: editState.original.totalWeight,
                color: editState.original.color,
                colorHex: editState.original.colorHex,
                material: editState.original.material,
                materialType: editState.original.materialType,
                isTemplate:
                    editState.id === 0 ? false : editState.original.isTemplate,
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

                        <form.Subscribe
                            selector={(state) => state.isDefaultValue}
                        >
                            {(isDefaultValue) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        createMutation.isPending ||
                                        updateMutation.isPending ||
                                        (editState.id > 0 && isDefaultValue)
                                    }
                                >
                                    {editState.id > 0 ? "Update" : "Create"}
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
