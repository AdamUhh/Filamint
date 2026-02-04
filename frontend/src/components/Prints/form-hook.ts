import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
    PrintCalendarFormField,
    PrintDateTimeFormField,
    PrintGramsUsedFormField,
    PrintNameFormField,
    PrintNotesFormField,
    PrintStatusFormField,
    PrintTimeFormField,
} from "./forms";

export const { fieldContext, formContext, useFieldContext } =
    createFormHookContexts();

export const { useAppForm } = createFormHook({
    fieldContext,
    formContext,
    fieldComponents: {
        PrintNameFormField,
        PrintGramsUsedFormField,
        PrintStatusFormField,
        PrintCalendarFormField,
        PrintTimeFormField,
        PrintDateTimeFormField,
        PrintNotesFormField,
    },
    formComponents: {},
});
