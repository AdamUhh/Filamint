import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/shadcn/button";
import { Calendar } from "@/shadcn/calendar";
import { Field, FieldError, FieldLabel } from "@/shadcn/field";
import { Input } from "@/shadcn/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/shadcn/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/popover";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import type { Print } from "@bindings";

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
                            ? format(new Date(field.state.value), "PPP")
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
