import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/shadcn/button";
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

import type { Print, Spool } from "@bindings";

import { useFieldContext } from "./form-hook";

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

export function PrintGramsUsedFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Print["gramsUsed"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex h-6 items-center justify-between">
                <FieldLabel htmlFor={field.name}>Grams Used</FieldLabel>
                <div className="hidden items-center gap-1 group-hover:flex">
                    {editingId > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-0 text-xs"
                            onClick={() => onReset(field.name)}
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

export function PrintSpoolFormField({
    editingId,
    onReset,
    spools,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
    spools: Spool[];
}) {
    const field = useFieldContext<Print["spoolId"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>Spools</FieldLabel>
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
            {/* // TODO: make it multiple, because a single print can use multiple spools for colors */}
            <Combobox
                modal
                name={field.name}
                onValueChange={(e) => field.handleChange(e ? parseInt(e) : 0)}
                value={String(field.state.value)}
                items={spools}
            >
                <ComboboxInput placeholder="Select a spool" />
                <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList className="pointer-events-auto">
                        {(spool: Spool) => (
                            <ComboboxItem
                                key={spool.id}
                                value={String(spool.id)}
                            >
                                <div className="grid w-full grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 font-mono hover:cursor-pointer">
                                    {/* Primary identifier */}
                                    <span className="col-span-3 font-medium">
                                        {spool.spoolCode}
                                    </span>

                                    {/* Vendor + color */}
                                    <span className="truncate text-muted-foreground">
                                        {spool.vendor} · {spool.color}
                                    </span>

                                    {/* Material */}
                                    <span className="truncate text-muted-foreground">
                                        {spool.material}
                                    </span>

                                    {/* Remaining weight */}
                                    <span className="text-right text-muted-foreground">
                                        {spool.totalWeight}g
                                    </span>
                                </div>
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>

            {isInvalid && <FieldError errors={field.state.meta.errors} />}
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
            <div className="flex h-6 items-center justify-between">
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
            <Select
                name={field.name}
                onValueChange={(e) => field.handleChange(e)}
                value={field.state.value}
            >
                <SelectTrigger className="w-45 capitalize">
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

export function PrintCalendarFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Print["datePrinted"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex h-6 items-center justify-between">
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
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id={field.name}
                        variant="outline"
                        className="justify-between"
                    >
                        {field.state.value
                            ? format(new Date(field.state.value), "PPp")
                            : "Select date"}
                        <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="start"
                >
                    <Calendar
                        mode="single"
                        selected={field.state.value}
                        captionLayout="dropdown"
                        defaultMonth={field.state.value}
                        onSelect={(date) => {
                            if (!date) return;
                            field.handleChange(format(date, "yyyy-MM-dd"));
                        }}
                    />
                </PopoverContent>
            </Popover>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function PrintTimeFormField({
    editingId,
    onReset,
}: {
    editingId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReset: (name: any) => void;
}) {
    const field = useFieldContext<Print["datePrinted"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <div className="flex h-6 items-center justify-between">
                <FieldLabel htmlFor={field.name}>Time</FieldLabel>
                <div className="hidden items-center gap-1 group-hover:flex">
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

            <Input
                id={field.name}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                type="time"
                step="1"
                className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                aria-invalid={isInvalid}
            />
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
            <div className="flex h-6 items-center justify-between">
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
                            <CalendarIcon />
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
