import type { Print, SpoolQueryParams } from "@bindings/services";
import { format } from "date-fns/format";
import { CalendarIcon, ChevronDownIcon, TrashIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import { Calendar } from "@/shadcn/calendar";
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

import { toErrorMessage } from "@/lib/util-format";

import { AppPagination } from "../Pagination";
import { AppSearch } from "../Search";
import { useSpool, useSpools } from "../Spools/lib/fetch-hooks";
import { SelectSpoolTable } from "./SelectSpoolTable";
import { Dropzone } from "./drop";
import { PAGE_SIZE } from "./lib/defaults";
import type { TPrintSchema } from "./lib/schema";

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
                placeholder="e.g. Gridfinity, Pen Holder"
                autoComplete="off"
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
        </Field>
    );
}

export function PrintGramsUsedFormField() {
    const field = useFieldContext<number>();

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

export function PrintSpoolParamFormField({ editingId }: { editingId: number }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const spoolId = searchParams.get("spoolId");
    const {
        data: spool,
        isFetching,
        isSuccess,
        isError,
        error,
    } = useSpool(spoolId ? Number(spoolId) : undefined);
    const field = useFieldContext<Print["spools"]>();
    const hasSelected = useRef(false);
    const [displayError, setDisplayError] = useState<string | null>(null);

    useEffect(() => {
        if (!spoolId || isFetching || hasSelected.current) return;

        if (isError) {
            setDisplayError(error.message);
            setSearchParams(new URLSearchParams());
            return;
        }

        if (!isSuccess || !spool) return;

        field.pushValue({
            id: editingId,
            printId: editingId,
            spoolId: spool.id,
            gramsUsed: 0,
            totalWeight: spool.totalWeight,
            usedWeight: spool.usedWeight,
            createdAt: spool.createdAt,
            updatedAt: spool.updatedAt,
            spoolCode: spool.spoolCode,
            vendor: spool.vendor,
            material: spool.material,
            color: spool.color,
            colorHex: spool.colorHex,
        });

        hasSelected.current = true;
        setSearchParams(new URLSearchParams());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spoolId, isFetching, isError, isSuccess]);

    useEffect(() => {
        if (!displayError) return;
        const timer = setTimeout(() => setDisplayError(null), 5000);
        return () => clearTimeout(timer);
    }, [displayError]);

    if (!displayError) return null;
    return (
        <p className="text-xs text-destructive">
            There was an error logging the spool:{" "}
            {toErrorMessage(displayError) || displayError}
        </p>
    );
}

export function PrintSpoolContainerFormField({
    editingId,
}: {
    editingId: number;
}) {
    const [queryParams, setQueryParams] = useState<SpoolQueryParams>({
        search: "",
        isTemplate: false,
        sortBy: "updated_at",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
    });

    const { spools, total, isFetching } = useSpools({
        ...queryParams,
    });

    const field = useFieldContext<Print["spools"]>();

    const handleSearch = (searchTerm: string) => {
        setQueryParams((prev) => ({
            ...prev,
            search: searchTerm,
            offset: 0,
        }));
    };

    const handleSort = (column: string) => {
        setQueryParams((prev) => ({
            ...prev,
            sortBy: column,
            sortOrder:
                prev.sortBy === column && prev.sortOrder === "desc"
                    ? "asc"
                    : "desc",
        }));
    };

    const handlePageChange = (page: number) => {
        setQueryParams((prev) => ({
            ...prev,
            offset: (page - 1) * PAGE_SIZE,
        }));
    };

    const currentPage =
        Math.floor(
            (queryParams.offset || 0) / (queryParams.limit || PAGE_SIZE)
        ) + 1;

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {field.state.value?.map((s, index) => (
                    <div
                        key={s.spoolId ?? index}
                        className="group relative flex h-8 w-fit items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="-mt-0.5 h-4 w-4 rounded shadow-[0_0_4px_0_#55555540]"
                                style={{
                                    backgroundColor: s.colorHex,
                                }}
                            />
                            <Button
                                type="button"
                                variant="ghost-destructive"
                                size="icon-xs"
                                className="absolute top-0.75 left-1 hidden bg-background group-hover:flex hover:bg-red-50"
                                onClick={() => field.removeValue(index)}
                            >
                                <TrashIcon className="size-3.5" />
                            </Button>

                            <span className="truncate">
                                <span className="font-medium">
                                    {s.spoolCode}
                                </span>
                                <span className="text-muted-foreground">
                                    {" "}
                                    · {s.vendor} · {s.material} · {s.color} ·{" "}
                                    {s.totalWeight - s.usedWeight}g
                                </span>
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between">
                <div className="flex w-full gap-2">
                    <AppSearch
                        onSearch={handleSearch}
                        qualifierKeys={["vendor", "spool", "material", "color"]}
                    />
                    <div className="mt-2 shrink-0 text-xs text-muted-foreground">
                        {isFetching
                            ? "Loading spools..."
                            : `Showing ${spools.size} of ${total} spools${
                                  queryParams.search
                                      ? ` matching "${queryParams.search}"`
                                      : ""
                              }`}
                    </div>
                </div>

                <AppPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            </div>
            <SelectSpoolTable
                editingId={editingId}
                value={field.state.value?.map((s) => s.spoolId) || []}
                onAdd={field.pushValue}
                onDelete={field.removeValue}
                spools={spools}
                isLoading={isFetching}
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder as "asc" | "desc"}
                onSort={handleSort}
            />
        </>
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
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
                <SelectTrigger className="text-xs font-medium capitalize">
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
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
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
                            <span className="text-xs">
                                {field.state.value
                                    ? format(new Date(field.state.value), "PPp")
                                    : "Select date & time"}
                            </span>
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

export function PrintFileUploadFormField() {
    const field = useFieldContext<TPrintSchema["models"]>();

    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

    return (
        <Field data-invalid={isInvalid} className="group">
            <Dropzone
                accept={{
                    "model/3mf": [".3mf"],
                    "model/stl": [".stl"],
                }}
                maxSize={5 * 1024 * 1024}
                value={field.state.value}
                onDelete={field.removeValue}
                onAdd={field.pushValue}
                multiple
            />
        </Field>
    );
}
