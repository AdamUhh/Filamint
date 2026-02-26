import { FieldGroup } from "@/shadcn/field";

import { defaultSpoolValues } from "@/components/Spools/lib/defaults";
import { withForm } from "@/components/Spools/lib/hooks";
import type { TSpoolSchema } from "@/components/Spools/lib/schema";

import type { EditState } from "./lib/types";

export const SpoolForm = withForm({
    defaultValues: defaultSpoolValues,
    props: {
        editState: {
            isOpen: false,
            id: 0,
            original: null,
        } as EditState,
    },
    render: function Render({ form, editState }) {
        const resetToOriginal = (field: keyof TSpoolSchema) => {
            if (!editState.original) return;

            form.setFieldValue(field, editState.original[field]);
        };

        return (
            <FieldGroup className="pb-4">
                <form.AppField
                    name="vendor"
                    children={(field) => (
                        <field.SpoolVendorFormField
                            editingId={editState.id}
                            onReset={resetToOriginal}
                        />
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <form.AppField
                        name="material"
                        children={(field) => (
                            <field.SpoolMaterialFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />

                    <form.AppField
                        name="materialType"
                        children={(field) => (
                            <field.SpoolMaterialTypeFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <form.AppField
                        name="color"
                        children={(field) => (
                            <field.SpoolColorFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />

                    <form.AppField
                        name="colorHex"
                        children={(field) => (
                            <field.SpoolColorHexFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <form.AppField
                        name="totalWeight"
                        children={(field) => (
                            <field.SpoolTotalWeightFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />

                    <div className="relative">
                        <form.AppField
                            name="usedWeight"
                            children={(field) => (
                                <field.SpoolUsedWeightFormField
                                    editingId={editState.id}
                                    onReset={resetToOriginal}
                                />
                            )}
                        />
                        <form.AppForm>
                            <form.SpoolRemainingWeight />
                        </form.AppForm>
                    </div>
                </div>

                <form.AppField
                    name="cost"
                    children={(field) => (
                        <field.SpoolCostFormField
                            editingId={editState.id}
                            onReset={resetToOriginal}
                        />
                    )}
                />

                <form.AppField
                    name="referenceLink"
                    children={(field) => (
                        <field.SpoolReferenceLinkFormField
                            editingId={editState.id}
                            onReset={resetToOriginal}
                        />
                    )}
                />

                <form.AppField
                    name="notes"
                    children={(field) => (
                        <field.SpoolNotesFormField
                            editingId={editState.id}
                            onReset={resetToOriginal}
                        />
                    )}
                />

                <form.AppField
                    name="isTemplate"
                    children={(field) => <field.SpoolIsTemplateFormField />}
                />
            </FieldGroup>
        );
    },
});
