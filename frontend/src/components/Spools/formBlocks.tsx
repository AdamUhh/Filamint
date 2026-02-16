import { useApp } from "@/context/useContext";
import { useStore } from "@tanstack/react-form";

import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import { Checkbox } from "@/shadcn/checkbox";
import {
    Autocomplete,
    AutocompleteContent,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
} from "@/shadcn/custom/autocomplete";
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

import { useFieldContext, useFormContext } from "@/components/Spools/lib/hooks";

import type { Spool } from "@bindings";

export function SpoolVendorFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Spool["vendor"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    type Vendor = {
        id: string;
        value: string;
    };

    const vendors: Vendor[] = [
        { id: "bambu_lab", value: "Bambu Lab" },
        { id: "prusa_research", value: "Prusa Research" },
        { id: "creality", value: "Creality" },
        { id: "elegoo", value: "Elegoo" },
        { id: "anycubic", value: "Anycubic" },
        { id: "flashforge", value: "FlashForge" },
        { id: "ultimaker", value: "UltiMaker" },
        { id: "raise3d", value: "Raise3D" },
        { id: "formlabs", value: "Formlabs" },
        { id: "makerbot", value: "MakerBot" },
        { id: "zortrax", value: "Zortrax" },
        { id: "qidi_tech", value: "QIDI Tech" },
        { id: "artillery", value: "Artillery" },
        { id: "snapmaker", value: "Snapmaker" },
        { id: "mingda", value: "Mingda" },
        { id: "tronxy", value: "Tronxy" },
        { id: "tevo", value: "Tevo" },
        { id: "biqu", value: "BIQU" },
        { id: "fokoos", value: "Fokoos" },
        { id: "ankermake", value: "AnkerMake" },
        { id: "kobra", value: "Anycubic Kobra" },
        { id: "phrozen", value: "Phrozen" },
        { id: "peopoly", value: "Peopoly" },
        { id: "epax", value: "EPAX" },
        { id: "rat_rig", value: "Rat Rig" },
        { id: "voron_design", value: "Voron Design" },
        { id: "lulzbot", value: "LulzBot" },
        { id: "robo3d", value: "Robo 3D" },
        { id: "taz", value: "LulzBot TAZ" },
        { id: "geeetech", value: "Geeetech" },
        { id: "modix", value: "Modix" },
        { id: "intamsys", value: "INTAMSYS" },
        { id: "tiertime", value: "Tiertime (UP)" },
        { id: "dremel_3d", value: "Dremel 3D" },
        { id: "xyzprinting", value: "XYZprinting" },
        { id: "delta_wasp", value: "WASP" },
        { id: "markforged", value: "Markforged" },
        { id: "stratasys", value: "Stratasys" },
        { id: "3d_systems", value: "3D Systems" },
        { id: "uniontech", value: "UnionTech" },
    ];

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Vendor</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Autocomplete
                name={field.name}
                items={vendors}
                value={field.state.value}
                onValueChange={field.handleChange}
                openOnInputClick
				modal
            >
                <AutocompleteInput
                    id={field.name}
                    onBlur={field.handleBlur}
                    aria-invalid={isInvalid}
                    placeholder="e.g., CC3D, Elegoo"
                    autoComplete="off"
                />
                <AutocompleteContent>
                    <AutocompleteEmpty>No items found.</AutocompleteEmpty>
                    <AutocompleteList className="pointer-events-auto">
                        {(tag: Vendor) => (
                            <AutocompleteItem key={tag.id} value={tag}>
                                {tag.value}
                            </AutocompleteItem>
                        )}
                    </AutocompleteList>
                </AutocompleteContent>
            </Autocomplete>
            {/* <Input */}
            {/*     id={field.name} */}
            {/*     name={field.name} */}
            {/*     value={field.state.value} */}
            {/*     onBlur={field.handleBlur} */}
            {/*     onChange={(e) => field.handleChange(e.target.value)} */}
            {/*     aria-invalid={isInvalid} */}
            {/*     placeholder="e.g., CC3D, Elegoo" */}
            {/*     autoComplete="off" */}
            {/* /> */}
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function SpoolMaterialFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Spool["totalWeight"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Total Weight</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <InputGroup>
                <InputGroupAddon className="group-hover:p-0" align="inline-end">
                    <InputGroupText className="group-hover:hidden">
                        grams
                    </InputGroupText>
                    <div className="hidden items-center group-hover:flex">
                        <ButtonGroup>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-base"
                                onClick={() =>
                                    field.handleChange(
                                        Math.max(
                                            0,
                                            (field.state.value || 0) - 1
                                        )
                                    )
                                }
                            >
                                -
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-base"
                                onClick={() =>
                                    field.handleChange(
                                        (field.state.value || 0) + 1
                                    )
                                }
                            >
                                +
                            </Button>
                        </ButtonGroup>
                    </div>
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Spool["usedWeight"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Used Weight</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <InputGroup>
                <InputGroupAddon className="group-hover:p-0" align="inline-end">
                    <InputGroupText className="group-hover:hidden">
                        grams
                    </InputGroupText>
                    <div className="hidden items-center group-hover:flex">
                        <ButtonGroup>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-base"
                                onClick={() =>
                                    field.handleChange(
                                        Math.max(
                                            0,
                                            (field.state.value || 0) - 1
                                        )
                                    )
                                }
                            >
                                -
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-base"
                                onClick={() =>
                                    field.handleChange(
                                        (field.state.value || 0) + 1
                                    )
                                }
                            >
                                +
                            </Button>
                        </ButtonGroup>
                    </div>
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

export function SpoolRemainingWeight() {
    const { store } = useFormContext();

    const remaining = useStore(
        store,
        (state) => state.values.totalWeight - state.values.usedWeight
    );

    return (
        <p className="absolute -bottom-6 left-2.5 text-muted-foreground tabular-nums">
            <span className="text-foreground">{remaining}</span> grams remaining
        </p>
    );
}

export function SpoolCostFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const { options } = useApp();
    const field = useFieldContext<Spool["cost"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Cost</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <InputGroup>
                <InputGroupAddon
                    align={
                        options.currencyAlign === "left"
                            ? "inline-start"
                            : "inline-end"
                    }
                >
                    <InputGroupText>AED</InputGroupText>
                </InputGroupAddon>
                <InputGroupAddon align="inline-end" className="p-0">
                    <div className="hidden items-center group-hover:flex">
                        <ButtonGroup>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-base"
                                onClick={() =>
                                    field.handleChange(
                                        Math.max(
                                            0,
                                            (field.state.value || 0) - 1
                                        )
                                    )
                                }
                            >
                                -
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-base"
                                onClick={() =>
                                    field.handleChange(
                                        (field.state.value || 0) + 1
                                    )
                                }
                            >
                                +
                            </Button>
                        </ButtonGroup>
                    </div>
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
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
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => onReset(field.name)}
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
