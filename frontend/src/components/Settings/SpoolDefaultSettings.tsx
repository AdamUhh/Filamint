import { useApp } from "@/context/useContext";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/shadcn/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupTextarea,
} from "@/shadcn/input-group";
import { Label } from "@/shadcn/label";

import {
    DEFAULT_SPOOL_COLORS,
    DEFAULT_SPOOL_MATERIALS,
    DEFAULT_SPOOL_MATERIALTYPES,
    DEFAULT_SPOOL_VENDORS,
} from "@/lib/constant-spools";

type Field = "vendors" | "materials" | "materialTypes" | "colors";

type ListSettingsProps = {
    title: string;
    field: Field;
    placeholder?: string;
};

const DEFAULTS: Record<Field, string[]> = {
    vendors: DEFAULT_SPOOL_VENDORS,
    materials: DEFAULT_SPOOL_MATERIALS,
    materialTypes: DEFAULT_SPOOL_MATERIALTYPES,
    colors: DEFAULT_SPOOL_COLORS,
};

const FIELDS: ListSettingsProps[] = [
    { title: "Vendors", field: "vendors", placeholder: "One vendor per line." },
    {
        title: "Materials",
        field: "materials",
        placeholder: "One material per line.",
    },
    {
        title: "Material Types",
        field: "materialTypes",
        placeholder: "One material type per line.",
    },
    { title: "Colors", field: "colors", placeholder: "One color per line." },
];

const normalize = (values: string[]) =>
    values.map((v) => v.trim()).filter(Boolean);

function DefaultSettings({
    title,
    field,
    placeholder = "One item per line...",
}: ListSettingsProps) {
    const { options, setOptions } = useApp();

    const source = useMemo(() => options[field] ?? [], [options, field]);

    const initialText = source.join("\n");
    const [text, setText] = useState(initialText);
    const lastSavedTextRef = useRef(initialText);

    const isDirty = useMemo(
        () =>
            normalize(text.split("\n")).join("\n") !==
            normalize(source).join("\n"),
        [text, source]
    );

    const handleSave = () => {
        if (!isDirty) return;
        const normalized = normalize(text.split("\n"));
        const joined = normalized.join("\n");
        setText(joined);
        lastSavedTextRef.current = joined;
        setOptions((prev) => ({ ...prev, [field]: normalized }));
    };

    const handleCancel = () => {
        setText(lastSavedTextRef.current);
    };

    return (
        <div className="group flex-1 space-y-2">
            <div className="flex h-4 items-center justify-between">
                <Label
                    htmlFor={field}
                    className="text-xs font-medium text-muted-foreground"
                >
                    {title}
                </Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                    onClick={() => setText(DEFAULTS[field].join("\n"))}
                >
                    Reset Defaults
                </Button>
            </div>

            <InputGroup className="pt-2 pr-0.5">
                <InputGroupTextarea
                    id={field}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                    className="max-h-32 min-h-32 py-0 text-sm"
                />
                <InputGroupAddon align="block-end" className="justify-end">
                    {isDirty && (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleCancel}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSave}>Save</Button>
                        </>
                    )}
                </InputGroupAddon>
            </InputGroup>
        </div>
    );
}

export function DefaultSpoolSettings() {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Autocomplete Defaults
                </h2>
                <p className="text-sm text-muted-foreground">
                    Manage the suggested values shown in spool input fields. One
                    item per line.
                </p>
            </div>

            <div className="grid grid-cols-2 grid-rows-2 gap-4">
                {FIELDS.map((row) => (
                    <DefaultSettings key={row.field} {...row} />
                ))}
            </div>
        </section>
    );
}
