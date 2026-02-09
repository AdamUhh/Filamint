import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
    PrintDateTimeFormField,
    PrintGramsUsedFormField,
    PrintNameFormField,
    PrintNotesFormField,
    PrintSpoolFormField,
    PrintStatusFormField,
} from "./forms";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts();

export const { useAppForm } = createFormHook({
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
