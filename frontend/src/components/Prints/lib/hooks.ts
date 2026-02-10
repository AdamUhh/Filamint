import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
    PrintDateTimeFormField,
    PrintGramsUsedFormField,
    PrintNameFormField,
    PrintNotesFormField,
    PrintSpoolFormField,
    PrintStatusFormField,
} from "@/components/Prints/formBlocks";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
    fieldContext,
    formContext,
    fieldComponents: {
        PrintNameFormField,
        PrintGramsUsedFormField,
        PrintStatusFormField,
        PrintDateTimeFormField,
        PrintNotesFormField,
        PrintSpoolFormField,
    },
    formComponents: {},
});
