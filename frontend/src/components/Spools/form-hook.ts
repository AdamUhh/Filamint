import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
    SpoolColorFormField,
    SpoolColorHexFormField,
    SpoolCostFormField,
    SpoolIsTemplateFormField,
    SpoolMaterialFormField,
    SpoolMaterialTypeFormField,
    SpoolNotesFormField,
    SpoolReferenceLinkFormField,
    SpoolRemainingWeight,
    SpoolTotalWeightFormField,
    SpoolUsedWeightFormField,
    SpoolVendorFormField,
} from "./forms";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts();

export const { useAppForm } = createFormHook({
    fieldContext,
    formContext,
    fieldComponents: {
        SpoolVendorFormField,
        SpoolMaterialFormField,
        SpoolMaterialTypeFormField,
        SpoolColorFormField,
        SpoolColorHexFormField,
        SpoolTotalWeightFormField,
        SpoolUsedWeightFormField,
        SpoolCostFormField,
        SpoolReferenceLinkFormField,
        SpoolNotesFormField,
        SpoolIsTemplateFormField,
    },
    formComponents: {
        SpoolRemainingWeight,
    },
});
