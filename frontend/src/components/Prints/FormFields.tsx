import { TrashIcon } from "lucide-react";

import { Button } from "@/shadcn/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shadcn/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shadcn/field";

import { defaultPrintValues } from "@/components/Prints/lib/defaults";
import { withForm } from "@/components/Prints/lib/hooks";
import type { TPrintSchema } from "@/components/Prints/lib/schema";

import type { EditState } from "./lib/types";

export const PrintForm = withForm({
    defaultValues: defaultPrintValues,
    props: {
        editState: {
            isOpen: false,
            id: 0,
            original: null,
        } as EditState,
    },
    render: function Render({ form, editState }) {
        const resetToOriginal = (field: keyof TPrintSchema) => {
            if (!editState.original) return;
            if (field === "models") return;

            form.setFieldValue(field, editState.original[field]);
        };

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
                                    className="flex-col"
                                >
                                    <div className="flex items-center justify-between">
                                        <FieldLabel>Spools</FieldLabel>

                                        <Dialog modal>
                                            <DialogTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 w-fit!"
                                                >
                                                    + Select Spools
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Select Spool
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <field.PrintSpoolContainerFormField
                                                    editingId={editState.id}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </div>

                                    {field.state.value.map((s, i) => (
                                        <div key={i} className="flex gap-2">
                                            <div className="group relative flex h-8 flex-2 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="-mt-0.5 h-4 w-4 rounded shadow-[0_0_4px_0_#55555540]"
                                                        style={{
                                                            backgroundColor:
                                                                s.colorHex,
                                                        }}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost-destructive"
                                                        size="icon-xs"
                                                        className="absolute top-0.75 left-1 hidden bg-background group-hover:flex hover:bg-red-50"
                                                        onClick={() =>
                                                            field.removeValue(i)
                                                        }
                                                    >
                                                        <TrashIcon className="size-3.5" />
                                                    </Button>

                                                    <span className="truncate">
                                                        <span className="font-medium">
                                                            {s.spoolCode}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {" "}
                                                            · {s.vendor} ·{" "}
                                                            {s.material} ·{" "}
                                                            {s.color}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>

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
                                </Field>
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

                <form.AppField
                    name="models"
                    children={(field) => <field.PrintFileUploadFormField />}
                />
            </FieldGroup>
        );
    },
});
