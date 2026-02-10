import { Button } from "@/shadcn/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shadcn/field";

import { defaultPrintValues } from "@/components/Prints/lib/defaults";
import { withForm } from "@/components/Prints/lib/hooks";

import type { Print, Spool } from "@bindings";

export const PrintDialogForm = withForm({
    defaultValues: defaultPrintValues,
    props: {
        editState: { id: 0 } as { id: number },
        resetToOriginal: (() => {}) as (field: keyof Print) => void,
        spools: [] as Spool[],
    },
    render: function Render({ form, editState, resetToOriginal, spools }) {
        return (
            <FieldGroup className="pb-4">
                <form.AppField
                    name="name"
                    children={(field) => (
                        <field.PrintNameFormField
                            editingId={editState.id}
                            onReset={resetToOriginal}
                        />
                    )}
                />

                <FieldGroup className="flex-row gap-2">
                    <form.AppField
                        name="datePrinted"
                        children={(field) => (
                            <field.PrintDateTimeFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />

                    <form.AppField
                        name="status"
                        children={(field) => (
                            <field.PrintStatusFormField
                                editingId={editState.id}
                                onReset={resetToOriginal}
                            />
                        )}
                    />
                </FieldGroup>

                <form.AppField
                    name="spools"
                    mode="array"
                    children={(field) => {
                        const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                        return (
                            <div className="space-y-2">
                                <Field
                                    data-invalid={isInvalid}
                                    className="flex-row"
                                >
                                    <FieldLabel>Spools</FieldLabel>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-fit!"
                                        onClick={() =>
                                            field.pushValue({
                                                spool: {
                                                    id: 0,
                                                    spoolCode: "",
                                                    color: "#000000",
                                                    material: "PLA",
                                                    vendor: "Bambu Labs",
                                                },
                                                gramsUsed: 0,
                                            })
                                        }
                                    >
                                        + Add Spool
                                    </Button>
                                </Field>
                                {field.state.value.map((_, i) => (
                                    <div key={i} className="flex gap-2">
                                        <form.AppField
                                            name={`spools[${i}].spool`}
                                            validators={{
                                                onMount: ({ value }) =>
                                                    value.id <= 0
                                                        ? "Please add a spool"
                                                        : undefined,
                                            }}
                                            children={(subField) => (
                                                <subField.PrintSpoolFormField
                                                    spools={spools}
                                                    onRemoveSpool={() =>
                                                        field.removeValue(i)
                                                    }
                                                />
                                            )}
                                        />
                                        <form.AppField
                                            key={i}
                                            name={`spools[${i}].gramsUsed`}
                                            children={(subField) => (
                                                <subField.PrintGramsUsedFormField />
                                            )}
                                        />
                                    </div>
                                ))}

                                {isInvalid && (
                                    <FieldError
                                        errors={field.state.meta.errors}
                                    />
                                )}
                            </div>
                        );
                    }}
                />

                <form.AppField
                    name="notes"
                    children={(field) => (
                        <field.PrintNotesFormField
                            editingId={editState.id}
                            onReset={resetToOriginal}
                        />
                    )}
                />
            </FieldGroup>
        );
    },
});
