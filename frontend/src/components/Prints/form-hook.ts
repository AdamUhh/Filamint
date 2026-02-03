import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
    PrintCalendarFormField,
    PrintGramsUsedFormField,
    PrintNameFormField,
    PrintStatusFormField,
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
    },
    formComponents: {},
});
