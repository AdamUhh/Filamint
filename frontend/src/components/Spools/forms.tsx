import { Button } from "@/shadcn/button";
import { Checkbox } from "@/shadcn/checkbox";
import { ColorPicker } from "@/shadcn/custom/color-picker";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@/shadcn/field";
import { Input } from "@/shadcn/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
    InputGroupTextarea,
} from "@/shadcn/input-group";

import type { Spool } from "@bindings";

import { useFieldContext } from "./form-hook";

export function SpoolVendorFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["vendor"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Vendor</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                placeholder="e.g., CC3D, Elegoo"
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolMaterialFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["material"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Material</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                placeholder="e.g., PLA, PETG, ABS"
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolMaterialTypeFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["materialType"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Material Type</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                placeholder="e.g., Basic, Pro, Silk"
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolColorFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["color"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Color</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                placeholder="e.g., Black, Blue"
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}
export function SpoolColorHexFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["colorHex"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Color Hex</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <ColorPicker
                name={field.name}
                error={isInvalid}
                value={field.state.value}
                onChange={(color) => field.handleChange(color)}
                onBlur={field.handleBlur}
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolTotalWeightFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["totalWeight"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex h-6 items-center justify-between">
                <FieldLabel htmlFor={field.name}>Remaining Weight</FieldLabel>
                <div className="hidden items-center gap-1 group-hover:flex">
                    {editingId > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-0 text-xs"
                            onClick={() => resetToOriginal(field.name)}
                        >
                            Reset
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                            field.handleChange(
                                Math.max(0, field.state.value - 1)
                            )
                        }
                    >
                        -
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                            field.handleChange(field.state.value + 1)
                        }
                    >
                        +
                    </Button>
                </div>
            </div>
            <InputGroup>
                <InputGroupAddon align="inline-end">
                    <InputGroupText>grams</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={Number(field.state.value).toString()}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                        field.handleChange(parseInt(e.target.value) || 0)
                    }
                    aria-invalid={isInvalid}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
            </InputGroup>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}
export function SpoolUsedWeightFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["usedWeight"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex h-6 items-center justify-between">
                <FieldLabel htmlFor={field.name}>Used Weight</FieldLabel>
                <div className="hidden items-center gap-1 group-hover:flex">
                    {editingId > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-0 text-xs"
                            onClick={() => resetToOriginal(field.name)}
                        >
                            Reset
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                            field.handleChange(
                                Math.max(0, field.state.value - 1)
                            )
                        }
                    >
                        -
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                            field.handleChange(field.state.value + 1)
                        }
                    >
                        +
                    </Button>
                </div>
            </div>
            <InputGroup>
                <InputGroupAddon align="inline-end">
                    <InputGroupText>grams</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={Number(field.state.value).toString()}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                        field.handleChange(parseInt(e.target.value) || 0)
                    }
                    aria-invalid={isInvalid}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
            </InputGroup>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolCostFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["cost"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex h-6 items-center justify-between">
                <FieldLabel htmlFor={field.name}>Cost</FieldLabel>
                <div className="hidden items-center gap-1 group-hover:flex">
                    {editingId > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                            onClick={() => resetToOriginal(field.name)}
                        >
                            Reset
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                            field.handleChange(
                                Math.max(0, field.state.value - 1)
                            )
                        }
                    >
                        -
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                            field.handleChange(field.state.value + 1)
                        }
                    >
                        +
                    </Button>
                </div>
            </div>
            <InputGroup>
                <InputGroupAddon>
                    <InputGroupText>AED</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={Number(field.state.value).toString()}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                        field.handleChange(parseFloat(e.target.value) || 0)
                    }
                    aria-invalid={isInvalid}
                    step="0.01"
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
            </InputGroup>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolReferenceLinkFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["referenceLink"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Reference Link</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Input
                id={field.name}
                name={field.name}
                type="url"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={isInvalid}
                placeholder="https://..."
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolNotesFormField({
    editingId,
    resetToOriginal,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resetToOriginal: (name: any) => void;
}) {
    const field = useFieldContext<Spool["notes"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => resetToOriginal(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <InputGroup>
                <InputGroupTextarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="Add any additional notes..."
                    rows={3}
                />
                <InputGroupAddon align="block-end">
                    <InputGroupText className="ml-auto">
                        {field.state.value.length}
                        /2000
                    </InputGroupText>
                </InputGroupAddon>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </InputGroup>
        </Field>
    );
}

export function SpoolIsTemplateFormField() {
    const field = useFieldContext<Spool["isTemplate"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} orientation="horizontal">
            <Checkbox
                id="isTemplate"
                name="isTemplate"
                checked={field.state.value === true}
                onCheckedChange={(e) => field.handleChange(e === true)}
            />
            <FieldContent>
                <FieldLabel htmlFor="isTemplate">Use as template?</FieldLabel>
                <FieldDescription>
                    Reuse this spool when buying the same filament again.
                </FieldDescription>
            </FieldContent>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}
