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
} from "@/components/Spools/FormBlocks";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
    createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
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
