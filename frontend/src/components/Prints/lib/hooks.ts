import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
    PrintDateTimeFormField,
    PrintFileUploadFormField,
    PrintGramsUsedFormField,
    PrintNameFormField,
    PrintNotesFormField,
    PrintSpoolContainerFormField,
    PrintSpoolParamFormField,
    PrintStatusFormField,
} from "@/components/Prints/FormBlocks";

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
        PrintSpoolContainerFormField,
        PrintSpoolParamFormField,
        PrintFileUploadFormField,
    },
    formComponents: {},
});
