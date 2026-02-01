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
    SpoolTotalWeightFormField,
    SpoolUsedWeightFormField,
    SpoolVendorFormField,
} from "./forms";

export const { fieldContext, formContext, useFieldContext } =
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
    formComponents: {},
});

// <form
//     onSubmit={(e) => {
//         e.preventDefault();
//         e.stopPropagation();
//         form.handleSubmit();
//     }}
// >
//     <FieldGroup className="pb-4">
//         <form.AppField
//             name="vendor"
//             children={(field) => (
//                 <field.SpoolVendorFormField
//                     editingId={editingId}
//                     resetToOriginal={resetToOriginal}
//                 />
//             )}
//         />
//         {/* <form.Field */}
//         {/*     name="vendor" */}
//         {/*     children={(field) => { */}
//         {/*         const isInvalid = */}
//         {/*             field.state.meta.isTouched && */}
//         {/*             !field.state.meta.isValid; */}
//         {/*         return ( */}
//         {/*             <Field */}
//         {/*                 data-invalid={isInvalid} */}
//         {/*                 className="group" */}
//         {/*             > */}
//         {/*                 <div className="flex items-center justify-between"> */}
//         {/*                     <FieldLabel */}
//         {/*                         htmlFor={field.name} */}
//         {/*                     > */}
//         {/*                         Vendor */}
//         {/*                     </FieldLabel> */}
//         {/*                     {editingId > 0 && ( */}
//         {/*                         <Button */}
//         {/*                             type="button" */}
//         {/*                             variant="ghost" */}
//         {/*                             size="sm" */}
//         {/*                             className="hidden h-auto px-2 py-0 text-xs group-hover:block" */}
//         {/*                             onClick={() => */}
//         {/*                                 resetToOriginal( */}
//         {/*                                     field.name */}
//         {/*                                 ) */}
//         {/*                             } */}
//         {/*                         > */}
//         {/*                             Reset */}
//         {/*                         </Button> */}
//         {/*                     )} */}
//         {/*                 </div> */}
//         {/*                 <Input */}
//         {/*                     id={field.name} */}
//         {/*                     name={field.name} */}
//         {/*                     value={field.state.value} */}
//         {/*                     onBlur={field.handleBlur} */}
//         {/*                     onChange={(e) => */}
//         {/*                         field.handleChange( */}
//         {/*                             e.target.value */}
//         {/*                         ) */}
//         {/*                     } */}
//         {/*                     aria-invalid={isInvalid} */}
//         {/*                     placeholder="e.g., CC3D, Elegoo" */}
//         {/*                     autoComplete="off" */}
//         {/*                 /> */}
//         {/*                 {isInvalid && ( */}
//         {/*                     <FieldError */}
//         {/*                         errors={ */}
//         {/*                             field.state.meta.errors */}
//         {/*                         } */}
//         {/*                     /> */}
//         {/*                 )} */}
//         {/*             </Field> */}
//         {/*         ); */}
//         {/*     }} */}
//         {/* /> */}
//
//         <div className="grid grid-cols-2 gap-4">
//
//         <form.AppField
//             name="vendor"
//             children={(field) => (
//                 <field.SpoolMaterialFormField
//                     editingId={editingId}
//                     resetToOriginal={resetToOriginal}
//                 />
//             )}
//         />
//
//         <form.AppField
//             name="vendor"
//             children={(field) => (
//                 <field.SpoolMaterialFormField
//                     editingId={editingId}
//                     resetToOriginal={resetToOriginal}
//                 />
//             )}
//         />
//             {/* <form.Field */}
//             {/*     name="material" */}
//             {/*     children={(field) => { */}
//             {/*         const isInvalid = */}
//             {/*             field.state.meta.isTouched && */}
//             {/*             !field.state.meta.isValid; */}
//             {/*         return ( */}
//             {/*             <Field */}
//             {/*                 data-invalid={isInvalid} */}
//             {/*                 className="group" */}
//             {/*             > */}
//             {/*                 <div className="flex items-center justify-between"> */}
//             {/*                     <FieldLabel */}
//             {/*                         htmlFor={field.name} */}
//             {/*                     > */}
//             {/*                         Material */}
//             {/*                     </FieldLabel> */}
//             {/*                     {editingId > 0 && ( */}
//             {/*                         <Button */}
//             {/*                             type="button" */}
//             {/*                             variant="ghost" */}
//             {/*                             size="sm" */}
//             {/*                             className="hidden h-auto px-2 py-0 text-xs group-hover:block" */}
//             {/*                             onClick={() => */}
//             {/*                                 resetToOriginal( */}
//             {/*                                     field.name */}
//             {/*                                 ) */}
//             {/*                             } */}
//             {/*                         > */}
//             {/*                             Reset */}
//             {/*                         </Button> */}
//             {/*                     )} */}
//             {/*                 </div> */}
//             {/*                 <Input */}
//             {/*                     id={field.name} */}
//             {/*                     name={field.name} */}
//             {/*                     value={field.state.value} */}
//             {/*                     onBlur={field.handleBlur} */}
//             {/*                     onChange={(e) => */}
//             {/*                         field.handleChange( */}
//             {/*                             e.target.value */}
//             {/*                         ) */}
//             {/*                     } */}
//             {/*                     aria-invalid={isInvalid} */}
//             {/*                     placeholder="e.g., PLA, PETG, ABS" */}
//             {/*                     autoComplete="off" */}
//             {/*                 /> */}
//             {/*                 {isInvalid && ( */}
//             {/*                     <FieldError */}
//             {/*                         errors={ */}
//             {/*                             field.state.meta */}
//             {/*                                 .errors */}
//             {/*                         } */}
//             {/*                     /> */}
//             {/*                 )} */}
//             {/*             </Field> */}
//             {/*         ); */}
//             {/*     }} */}
//             {/* /> */}
//
//             <form.Field
//                 name="materialType"
//                 children={(field) => {
//                     const isInvalid =
//                         field.state.meta.isTouched &&
//                         !field.state.meta.isValid;
//                     return (
//                         <Field
//                             data-invalid={isInvalid}
//                             className="group"
//                         >
//                             <div className="flex items-center justify-between">
//                                 <FieldLabel
//                                     htmlFor={field.name}
//                                 >
//                                     Material Type
//                                 </FieldLabel>
//                                 {editingId > 0 && (
//                                     <Button
//                                         type="button"
//                                         variant="ghost"
//                                         size="sm"
//                                         className="hidden h-auto px-2 py-0 text-xs group-hover:block"
//                                         onClick={() =>
//                                             resetToOriginal(
//                                                 field.name
//                                             )
//                                         }
//                                     >
//                                         Reset
//                                     </Button>
//                                 )}
//                             </div>
//                             <Input
//                                 id={field.name}
//                                 name={field.name}
//                                 value={field.state.value}
//                                 onBlur={field.handleBlur}
//                                 onChange={(e) =>
//                                     field.handleChange(
//                                         e.target.value
//                                     )
//                                 }
//                                 aria-invalid={isInvalid}
//                                 placeholder="e.g., Basic, Pro, Silk"
//                                 autoComplete="off"
//                             />
//                             {isInvalid && (
//                                 <FieldError
//                                     errors={
//                                         field.state.meta
//                                             .errors
//                                     }
//                                 />
//                             )}
//                         </Field>
//                     );
//                 }}
//             />
//         </div>
//
//         <div className="grid grid-cols-2 gap-4">
//             <form.Field
//                 name="color"
//                 children={(field) => {
//                     const isInvalid =
//                         field.state.meta.isTouched &&
//                         !field.state.meta.isValid;
//                     return (
//                         <Field
//                             data-invalid={isInvalid}
//                             className="group"
//                         >
//                             <div className="flex items-center justify-between">
//                                 <FieldLabel
//                                     htmlFor={field.name}
//                                 >
//                                     Color
//                                 </FieldLabel>
//                                 {editingId > 0 && (
//                                     <Button
//                                         type="button"
//                                         variant="ghost"
//                                         size="sm"
//                                         className="hidden h-auto px-2 py-0 text-xs group-hover:block"
//                                         onClick={() =>
//                                             resetToOriginal(
//                                                 field.name
//                                             )
//                                         }
//                                     >
//                                         Reset
//                                     </Button>
//                                 )}
//                             </div>
//                             <Input
//                                 id={field.name}
//                                 name={field.name}
//                                 value={field.state.value}
//                                 onBlur={field.handleBlur}
//                                 onChange={(e) =>
//                                     field.handleChange(
//                                         e.target.value
//                                     )
//                                 }
//                                 aria-invalid={isInvalid}
//                                 placeholder="e.g., Black, Blue"
//                                 autoComplete="off"
//                             />
//                             {isInvalid && (
//                                 <FieldError
//                                     errors={
//                                         field.state.meta
//                                             .errors
//                                     }
//                                 />
//                             )}
//                         </Field>
//                     );
//                 }}
//             />
//
//             <form.Field
//                 name="colorHex"
//                 children={(field) => {
//                     const isInvalid =
//                         field.state.meta.isTouched &&
//                         !field.state.meta.isValid;
//                     return (
//                         <Field
//                             data-invalid={isInvalid}
//                             className="group"
//                         >
//                             <div className="flex items-center justify-between">
//                                 <FieldLabel
//                                     htmlFor={field.name}
//                                 >
//                                     Color Hex
//                                 </FieldLabel>
//                                 {editingId > 0 && (
//                                     <Button
//                                         type="button"
//                                         variant="ghost"
//                                         size="sm"
//                                         className="hidden h-auto px-2 py-0 text-xs group-hover:block"
//                                         onClick={() =>
//                                             resetToOriginal(
//                                                 field.name
//                                             )
//                                         }
//                                     >
//                                         Reset
//                                     </Button>
//                                 )}
//                             </div>
//                             <ColorPicker
//                                 name={field.name}
//                                 error={isInvalid}
//                                 value={field.state.value}
//                                 onChange={(color) =>
//                                     field.handleChange(
//                                         color
//                                     )
//                                 }
//                                 onBlur={field.handleBlur}
//                             />
//                             {isInvalid && (
//                                 <FieldError
//                                     errors={
//                                         field.state.meta
//                                             .errors
//                                     }
//                                 />
//                             )}
//                         </Field>
//                     );
//                 }}
//             />
//         </div>
//
//         <div className="grid grid-cols-2 gap-4">
//             <form.Field
//                 name="totalWeight"
//                 children={(field) => {
//                     const isInvalid =
//                         field.state.meta.isTouched &&
//                         !field.state.meta.isValid;
//                     return (
//                         <Field
//                             data-invalid={isInvalid}
//                             className="group"
//                         >
//                             <div className="flex h-6 items-center justify-between">
//                                 <FieldLabel
//                                     htmlFor={field.name}
//                                 >
//                                     Remaining Weight
//                                 </FieldLabel>
//                                 <div className="hidden items-center gap-1 group-hover:flex">
//                                     {editingId > 0 && (
//                                         <Button
//                                             type="button"
//                                             variant="ghost"
//                                             size="sm"
//                                             className="h-auto px-2 py-0 text-xs"
//                                             onClick={() =>
//                                                 resetToOriginal(
//                                                     field.name
//                                                 )
//                                             }
//                                         >
//                                             Reset
//                                         </Button>
//                                     )}
//                                     <Button
//                                         type="button"
//                                         variant="outline"
//                                         size="sm"
//                                         className="h-6 w-6 p-0"
//                                         onClick={() =>
//                                             field.handleChange(
//                                                 Math.max(
//                                                     0,
//                                                     field
//                                                         .state
//                                                         .value -
//                                                         1
//                                                 )
//                                             )
//                                         }
//                                     >
//                                         -
//                                     </Button>
//                                     <Button
//                                         type="button"
//                                         variant="outline"
//                                         size="sm"
//                                         className="h-6 w-6 p-0"
//                                         onClick={() =>
//                                             field.handleChange(
//                                                 field.state
//                                                     .value +
//                                                     1
//                                             )
//                                         }
//                                     >
//                                         +
//                                     </Button>
//                                 </div>
//                             </div>
//                             <InputGroup>
//                                 <InputGroupAddon align="inline-end">
//                                     <InputGroupText>
//                                         grams
//                                     </InputGroupText>
//                                 </InputGroupAddon>
//                                 <InputGroupInput
//                                     id={field.name}
//                                     name={field.name}
//                                     type="number"
//                                     value={Number(
//                                         field.state.value
//                                     ).toString()}
//                                     onBlur={
//                                         field.handleBlur
//                                     }
//                                     onChange={(e) =>
//                                         field.handleChange(
//                                             parseInt(
//                                                 e.target
//                                                     .value
//                                             ) || 0
//                                         )
//                                     }
//                                     aria-invalid={isInvalid}
//                                     className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
//                                 />
//                             </InputGroup>
//                             {isInvalid && (
//                                 <FieldError
//                                     errors={
//                                         field.state.meta
//                                             .errors
//                                     }
//                                 />
//                             )}
//                         </Field>
//                     );
//                 }}
//             />
//
//             <form.Field
//                 name="usedWeight"
//                 children={(field) => {
//                     const isInvalid =
//                         field.state.meta.isTouched &&
//                         !field.state.meta.isValid;
//                     return (
//                         <Field
//                             data-invalid={isInvalid}
//                             className="group"
//                         >
//                             <div className="flex h-6 items-center justify-between">
//                                 <FieldLabel
//                                     htmlFor={field.name}
//                                 >
//                                     Used Weight
//                                 </FieldLabel>
//                                 <div className="hidden items-center gap-1 group-hover:flex">
//                                     {editingId > 0 && (
//                                         <Button
//                                             type="button"
//                                             variant="ghost"
//                                             size="sm"
//                                             className="h-auto px-2 py-0 text-xs"
//                                             onClick={() =>
//                                                 resetToOriginal(
//                                                     field.name
//                                                 )
//                                             }
//                                         >
//                                             Reset
//                                         </Button>
//                                     )}
//                                     <Button
//                                         type="button"
//                                         variant="outline"
//                                         size="sm"
//                                         className="h-6 w-6 p-0"
//                                         onClick={() =>
//                                             field.handleChange(
//                                                 Math.max(
//                                                     0,
//                                                     field
//                                                         .state
//                                                         .value -
//                                                         1
//                                                 )
//                                             )
//                                         }
//                                     >
//                                         -
//                                     </Button>
//                                     <Button
//                                         type="button"
//                                         variant="outline"
//                                         size="sm"
//                                         className="h-6 w-6 p-0"
//                                         onClick={() =>
//                                             field.handleChange(
//                                                 field.state
//                                                     .value +
//                                                     1
//                                             )
//                                         }
//                                     >
//                                         +
//                                     </Button>
//                                 </div>
//                             </div>
//                             <InputGroup>
//                                 <InputGroupAddon align="inline-end">
//                                     <InputGroupText>
//                                         grams
//                                     </InputGroupText>
//                                 </InputGroupAddon>
//                                 <InputGroupInput
//                                     id={field.name}
//                                     name={field.name}
//                                     type="number"
//                                     value={Number(
//                                         field.state.value
//                                     ).toString()}
//                                     onBlur={
//                                         field.handleBlur
//                                     }
//                                     onChange={(e) =>
//                                         field.handleChange(
//                                             parseInt(
//                                                 e.target
//                                                     .value
//                                             ) || 0
//                                         )
//                                     }
//                                     aria-invalid={isInvalid}
//                                     className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
//                                 />
//                             </InputGroup>
//                             {isInvalid && (
//                                 <FieldError
//                                     errors={
//                                         field.state.meta
//                                             .errors
//                                     }
//                                 />
//                             )}
//                         </Field>
//                     );
//                 }}
//             />
//         </div>
//
//         <form.Field
//             name="cost"
//             children={(field) => {
//                 const isInvalid =
//                     field.state.meta.isTouched &&
//                     !field.state.meta.isValid;
//                 return (
//                     <Field
//                         data-invalid={isInvalid}
//                         className="group"
//                     >
//                         <div className="flex h-6 items-center justify-between">
//                             <FieldLabel
//                                 htmlFor={field.name}
//                             >
//                                 Cost
//                             </FieldLabel>
//                             <div className="hidden items-center gap-1 group-hover:flex">
//                                 {editingId > 0 && (
//                                     <Button
//                                         type="button"
//                                         variant="ghost"
//                                         size="sm"
//                                         className="hidden h-auto px-2 py-0 text-xs group-hover:block"
//                                         onClick={() =>
//                                             resetToOriginal(
//                                                 field.name
//                                             )
//                                         }
//                                     >
//                                         Reset
//                                     </Button>
//                                 )}
//                                 <Button
//                                     type="button"
//                                     variant="outline"
//                                     size="sm"
//                                     className="h-6 w-6 p-0"
//                                     onClick={() =>
//                                         field.handleChange(
//                                             Math.max(
//                                                 0,
//                                                 field.state
//                                                     .value -
//                                                     1
//                                             )
//                                         )
//                                     }
//                                 >
//                                     -
//                                 </Button>
//                                 <Button
//                                     type="button"
//                                     variant="outline"
//                                     size="sm"
//                                     className="h-6 w-6 p-0"
//                                     onClick={() =>
//                                         field.handleChange(
//                                             field.state
//                                                 .value + 1
//                                         )
//                                     }
//                                 >
//                                     +
//                                 </Button>
//                             </div>
//                         </div>
//                         <InputGroup>
//                             <InputGroupAddon>
//                                 <InputGroupText>
//                                     AED
//                                 </InputGroupText>
//                             </InputGroupAddon>
//                             <InputGroupInput
//                                 id={field.name}
//                                 name={field.name}
//                                 type="number"
//                                 value={Number(
//                                     field.state.value
//                                 ).toString()}
//                                 onBlur={field.handleBlur}
//                                 onChange={(e) =>
//                                     field.handleChange(
//                                         parseFloat(
//                                             e.target.value
//                                         ) || 0
//                                     )
//                                 }
//                                 aria-invalid={isInvalid}
//                                 step="0.01"
//                                 className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
//                             />
//                         </InputGroup>
//                         {isInvalid && (
//                             <FieldError
//                                 errors={
//                                     field.state.meta.errors
//                                 }
//                             />
//                         )}
//                     </Field>
//                 );
//             }}
//         />
//
//         <form.Field
//             name="referenceLink"
//             children={(field) => {
//                 const isInvalid =
//                     field.state.meta.isTouched &&
//                     !field.state.meta.isValid;
//                 return (
//                     <Field
//                         data-invalid={isInvalid}
//                         className="group"
//                     >
//                         <div className="flex items-center justify-between">
//                             <FieldLabel
//                                 htmlFor={field.name}
//                             >
//                                 Reference Link
//                             </FieldLabel>
//                             {editingId > 0 && (
//                                 <Button
//                                     type="button"
//                                     variant="ghost"
//                                     size="sm"
//                                     className="hidden h-auto px-2 py-0 text-xs group-hover:block"
//                                     onClick={() =>
//                                         resetToOriginal(
//                                             field.name
//                                         )
//                                     }
//                                 >
//                                     Reset
//                                 </Button>
//                             )}
//                         </div>
//                         <Input
//                             id={field.name}
//                             name={field.name}
//                             type="url"
//                             value={field.state.value}
//                             onBlur={field.handleBlur}
//                             onChange={(e) =>
//                                 field.handleChange(
//                                     e.target.value
//                                 )
//                             }
//                             aria-invalid={isInvalid}
//                             placeholder="https://..."
//                             autoComplete="off"
//                         />
//                         {isInvalid && (
//                             <FieldError
//                                 errors={
//                                     field.state.meta.errors
//                                 }
//                             />
//                         )}
//                     </Field>
//                 );
//             }}
//         />
//
//         <form.Field
//             name="notes"
//             children={(field) => {
//                 const isInvalid =
//                     field.state.meta.isTouched &&
//                     !field.state.meta.isValid;
//                 return (
//                     <Field
//                         data-invalid={isInvalid}
//                         className="group"
//                     >
//                         <div className="flex items-center justify-between">
//                             <FieldLabel
//                                 htmlFor={field.name}
//                             >
//                                 Notes
//                             </FieldLabel>
//                             {editingId > 0 && (
//                                 <Button
//                                     type="button"
//                                     variant="ghost"
//                                     size="sm"
//                                     className="hidden h-auto px-2 py-0 text-xs group-hover:block"
//                                     onClick={() =>
//                                         resetToOriginal(
//                                             field.name
//                                         )
//                                     }
//                                 >
//                                     Reset
//                                 </Button>
//                             )}
//                         </div>
//                         <InputGroup>
//                             <InputGroupTextarea
//                                 id={field.name}
//                                 name={field.name}
//                                 value={field.state.value}
//                                 onBlur={field.handleBlur}
//                                 onChange={(e) =>
//                                     field.handleChange(
//                                         e.target.value
//                                     )
//                                 }
//                                 aria-invalid={isInvalid}
//                                 placeholder="Add any additional notes..."
//                                 rows={3}
//                             />
//                             <InputGroupAddon align="block-end">
//                                 <InputGroupText className="ml-auto">
//                                     {
//                                         field.state.value
//                                             .length
//                                     }
//                                     /2000
//                                 </InputGroupText>
//                             </InputGroupAddon>
//                             {isInvalid && (
//                                 <FieldError
//                                     errors={
//                                         field.state.meta
//                                             .errors
//                                     }
//                                 />
//                             )}
//                         </InputGroup>
//                     </Field>
//                 );
//             }}
//         />
//
//         <form.Field
//             name="isTemplate"
//             children={(field) => {
//                 const isInvalid =
//                     field.state.meta.isTouched &&
//                     !field.state.meta.isValid;
//
//                 return (
//                     <Field
//                         data-invalid={isInvalid}
//                         orientation="horizontal"
//                     >
//                         <Checkbox
//                             id="isTemplate"
//                             name="isTemplate"
//                             checked={
//                                 field.state.value === true
//                             }
//                             onCheckedChange={(e) =>
//                                 field.handleChange(
//                                     e === true
//                                 )
//                             }
//                         />
//                         <FieldContent>
//                             <FieldLabel htmlFor="isTemplate">
//                                 Use as template?
//                             </FieldLabel>
//                             <FieldDescription>
//                                 Reuse this spool when buying
//                                 the same filament again.
//                             </FieldDescription>
//                         </FieldContent>
//                         {isInvalid && (
//                             <FieldError
//                                 errors={
//                                     field.state.meta.errors
//                                 }
//                             />
//                         )}
//                     </Field>
//                 );
//             }}
//         />
//     </FieldGroup>
//     <DialogFooter>
//         <Button
//             type="button"
//             variant="outline"
//             onClick={() => setEditDialogOpen(false)}
//         >
//             Cancel
//         </Button>
//         <Button type="submit">
//             {editingId > 0 ? "Update" : "Create"}
//         </Button>
//     </DialogFooter>
// </form>
