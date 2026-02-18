"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { XIcon } from "lucide-react";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/shadcn/input-group";

import { cn } from "@/lib/utils";

import { Button } from "../button";

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

const Autocomplete = AutocompletePrimitive.Root;

/* -------------------------------------------------------------------------------------------------
 * Input
 * -----------------------------------------------------------------------------------------------*/

function AutocompleteInput({
    className,
    disabled = false,
    showClear = true,
    showSave = false,
    onSave,
    ...props
}: AutocompletePrimitive.Input.Props & {
    showClear?: boolean;
    showSave?: boolean;
    onSave?: () => void;
}) {
    return (
        <InputGroup className={cn("w-auto", className)}>
            <AutocompletePrimitive.Input
                render={<InputGroupInput disabled={disabled} />}
                {...props}
            />
            <InputGroupAddon
                align="inline-end"
                className={cn(showSave && "pr-1")}
            >
                {showClear && (
                    <AutocompletePrimitive.Clear
                        data-slot="autocomplete-clear"
                        render={
                            <InputGroupButton variant="ghost" size="icon-xs" />
                        }
                        disabled={disabled}
                    >
                        <XIcon className="pointer-events-none" />
                    </AutocompletePrimitive.Clear>
                )}
                {onSave && showSave && <Button onClick={onSave}>Save</Button>}
            </InputGroupAddon>
        </InputGroup>
    );
}

/* -------------------------------------------------------------------------------------------------
 * Content / Popup
 * -----------------------------------------------------------------------------------------------*/

function AutocompleteContent({
    className,
    side = "bottom",
    sideOffset = 6,
    align = "start",
    alignOffset = 0,
    anchor,
    ...props
}: AutocompletePrimitive.Popup.Props &
    Pick<
        AutocompletePrimitive.Positioner.Props,
        "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
    >) {
    return (
        <AutocompletePrimitive.Portal>
            <AutocompletePrimitive.Positioner
                side={side}
                sideOffset={sideOffset}
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                className="isolate z-50"
            >
                <AutocompletePrimitive.Popup
                    data-slot="autocomplete-content"
                    className={cn(
                        "group/combobox-content pointer-events-auto relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-24 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                        className
                    )}
                    onWheel={(e) => e.stopPropagation()}
                    {...props}
                />
            </AutocompletePrimitive.Positioner>
        </AutocompletePrimitive.Portal>
    );
}

/* -------------------------------------------------------------------------------------------------
 * List
 * -----------------------------------------------------------------------------------------------*/

function AutocompleteList({
    className,
    ...props
}: AutocompletePrimitive.List.Props) {
    return (
        <AutocompletePrimitive.List
            data-slot="autocomplete-list"
            className={cn(
                "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))]",
                "scroll-py-1 overflow-y-auto p-1 data-empty:p-0",
                "pointer-events-none",
                className
            )}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------------------------------
 * Item
 * -----------------------------------------------------------------------------------------------*/

function AutocompleteItem({
    className,
    children,
    ...props
}: AutocompletePrimitive.Item.Props) {
    return (
        <AutocompletePrimitive.Item
            data-slot="autocomplete-item"
            className={cn(
                "relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1 pr-1.5 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                "pointer-events-auto",
                className
            )}
            {...props}
        >
            {children}
        </AutocompletePrimitive.Item>
    );
}

/* -------------------------------------------------------------------------------------------------
 * Empty
 * -----------------------------------------------------------------------------------------------*/

function AutocompleteEmpty({
    className,
    ...props
}: AutocompletePrimitive.Empty.Props) {
    return (
        <AutocompletePrimitive.Empty
            data-slot="autocomplete-empty"
            className={cn(
                "hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex",
                className
            )}
            {...props}
        />
    );
}

/* -------------------------------------------------------------------------------------------------
 * Collection (optional helper)
 * -----------------------------------------------------------------------------------------------*/

function AutocompleteCollection({
    ...props
}: AutocompletePrimitive.Collection.Props) {
    return (
        <AutocompletePrimitive.Collection
            data-slot="autocomplete-collection"
            {...props}
        />
    );
}

export {
    Autocomplete,
    AutocompleteCollection,
    AutocompleteContent,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
};
