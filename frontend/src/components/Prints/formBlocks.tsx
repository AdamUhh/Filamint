import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon, TrashIcon } from "lucide-react";

import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import { Calendar } from "@/shadcn/calendar";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shadcn/combobox";
import { Field, FieldError, FieldLabel } from "@/shadcn/field";
import { Input } from "@/shadcn/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
    InputGroupTextarea,
} from "@/shadcn/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/popover";
import { ScrollArea } from "@/shadcn/scroll-area";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import { useFieldContext } from "@/components/Prints/lib/hooks";
import type { TPrintSchema } from "@/components/Prints/lib/schema";

import type { ArrayElementOf } from "@/lib/util-types";

import type { Print, Spool } from "@bindings";

export function PrintNameFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Print["name"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Print Name</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
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
                placeholder="e.g., CC3D, Elegoo"
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function PrintGramsUsedFormField() {
    const field = useFieldContext<number | undefined>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group flex-1">
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
                    value={Number(field.state.value).toString() ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                        field.handleChange(parseInt(e.target.value) || 0)
                    }
                    aria-invalid={isInvalid}
                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
            </InputGroup>
            {/* {isInvalid && <FieldError errors={field.state.meta.errors} />} */}
        </Field>
    );
}

export function PrintSpoolFormField({
    spools,
    onRemoveSpool: onRemoveSpool,
}: {
    spools: Spool[];
    onRemoveSpool: () => void;
}) {
    const field =
        useFieldContext<ArrayElementOf<TPrintSchema["spools"]>["spool"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    const selectedSpool =
        spools.find((s) => s.id === field.state.value?.id) ?? null;

    return (
        <Field data-invalid={isInvalid} className="group flex-3">
            <Combobox
                name={field.name}
                items={spools}
                value={selectedSpool}
                onValueChange={(value) =>
                    value &&
                    field.handleChange({
                        id: value.id,
                        spoolCode: value.spoolCode,
                        color: value.color,
                        material: value.material,
                        vendor: value.vendor,
                    })
                }
                itemToStringLabel={(value) =>
                    `${value.spoolCode} - ${value.vendor} - ${value.color} - ${value.material}`
                }
            >
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline-destructive"
                        size="sm"
                        className="aspect-square h-full p-0"
                        onClick={onRemoveSpool}
                    >
                        <TrashIcon className="size-3" />
                    </Button>
                    <ComboboxInput
                        className="w-full"
                        placeholder="Select a spool"
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                    />
                </div>
                <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList className="pointer-events-auto">
                        {(spool: Spool) => (
                            <ComboboxItem key={spool.id} value={spool}>
                                <div className="flex w-full items-center justify-between font-mono hover:cursor-pointer">
                                    <div className="flex flex-col gap-1">
                                        <span className="col-span-3 font-medium">
                                            {spool.spoolCode}
                                        </span>

                                        <span className="truncate text-muted-foreground">
                                            {spool.vendor} · {spool.color} ·{" "}
                                            {spool.material}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <span className="text-right text-muted-foreground opacity-0">
                                            {spool.id}
                                        </span>
                                        <span className="text-right text-muted-foreground">
                                            {spool.totalWeight}g
                                        </span>
                                    </div>
                                </div>
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            {/* {isInvalid && <FieldError errors={field.state.meta.errors} />} */}
        </Field>
    );
}

export function PrintStatusFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Print["status"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Print Status</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => onReset(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>
            <Select
                name={field.name}
                onValueChange={(e) => field.handleChange(e)}
                value={field.state.value}
            >
                <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                    <SelectGroup className="capitalize">
                        <SelectItem value="completed">completed</SelectItem>
                        <SelectItem value="failed">failed</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>

            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function PrintDateTimeFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    // Source: https://github.com/rudrodip/shadcn-date-time-picker
    const field = useFieldContext<Print["datePrinted"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    const handleDateSelect = (selectedDate: Date | undefined) => {
        if (!selectedDate) return;
        const newDate = field.state.value
            ? new Date(field.state.value)
            : new Date();
        newDate.setFullYear(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate()
        );
        field.handleChange(newDate.toISOString());
    };

    const handleTimeChange = (
        type: "hour" | "minute" | "ampm",
        value: string
    ) => {
        if (!field.state.value) return;
        const newDate = new Date(field.state.value);
        if (type === "hour") {
            newDate.setHours(
                (parseInt(value) % 12) + (newDate.getHours() >= 12 ? 12 : 0)
            );
        } else if (type === "minute") {
            newDate.setMinutes(parseInt(value));
        } else if (type === "ampm") {
            const currentHours = newDate.getHours();
            newDate.setHours(
                value === "PM" ? currentHours + 12 : currentHours - 12
            );
        }
        field.handleChange(newDate.toISOString());
    };

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const ampm = ["AM", "PM"];

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Date Printed</FieldLabel>
                {editingId > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                        onClick={() => onReset(field.name)}
                    >
                        Reset
                    </Button>
                )}
            </div>

            <Popover modal>
                <PopoverTrigger asChild>
                    <Button
                        id={field.name}
                        variant="outline"
                        className="w-full justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="size-3.5" />
                            {field.state.value
                                ? format(new Date(field.state.value), "PPp")
                                : "Select date & time"}
                        </div>
                        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <div className="sm:flex">
                        <Calendar
                            mode="single"
                            selected={
                                field.state.value
                                    ? new Date(field.state.value)
                                    : undefined
                            }
                            onSelect={handleDateSelect}
                        />
                        <div className="flex flex-col divide-y sm:h-75 sm:flex-row sm:divide-x sm:divide-y-0">
                            <ScrollArea className="w-64 sm:w-auto">
                                <div className="flex p-2 sm:flex-col">
                                    {hours.reverse().map((hour) => (
                                        <Button
                                            key={hour}
                                            size="icon"
                                            variant={
                                                field.state.value &&
                                                new Date(
                                                    field.state.value
                                                ).getHours() %
                                                    12 ===
                                                    hour % 12
                                                    ? "default"
                                                    : "ghost"
                                            }
                                            className="aspect-square shrink-0 sm:w-full"
                                            onClick={() =>
                                                handleTimeChange(
                                                    "hour",
                                                    hour.toString()
                                                )
                                            }
                                        >
                                            {hour}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                            <ScrollArea className="w-64 sm:w-auto">
                                <div className="flex p-2 sm:flex-col">
                                    {minutes.map((minute) => (
                                        <Button
                                            key={minute}
                                            size="icon"
                                            variant={
                                                field.state.value &&
                                                new Date(
                                                    field.state.value
                                                ).getMinutes() === minute
                                                    ? "default"
                                                    : "ghost"
                                            }
                                            className="aspect-square shrink-0 sm:w-full"
                                            onClick={() =>
                                                handleTimeChange(
                                                    "minute",
                                                    minute.toString()
                                                )
                                            }
                                        >
                                            {minute}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="flex p-2 sm:flex-col">
                                {ampm.map((ap) => (
                                    <Button
                                        key={ap}
                                        size="icon"
                                        variant={
                                            field.state.value &&
                                            ((ap === "AM" &&
                                                new Date(
                                                    field.state.value
                                                ).getHours() < 12) ||
                                                (ap === "PM" &&
                                                    new Date(
                                                        field.state.value
                                                    ).getHours() >= 12))
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="aspect-square shrink-0 sm:w-full"
                                        onClick={() =>
                                            handleTimeChange("ampm", ap)
                                        }
                                    >
                                        {ap}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function PrintNotesFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Print["notes"]>();

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
