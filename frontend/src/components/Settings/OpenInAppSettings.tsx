import { type AppOptions, useApp } from "@/context/useContext";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupTextarea,
} from "@/shadcn/input-group";

import {
    DEFAULT_LINUX_OPEN_IN_APP,
    DEFAULT_MAC_OPEN_IN_APP,
    DEFAULT_OPEN_IN_APP,
} from "@/lib/constant-spools";
import { tryParseJson } from "@/lib/util-format";
import { cn } from "@/lib/utils";

function prettyJson(value: AppOptions["openInApp"]) {
    return JSON.stringify(value, null, 2);
}

function parseValue(text: string): AppOptions["openInApp"] | null {
    const parsed = tryParseJson(text);
    if (
        Array.isArray(parsed) &&
        parsed.every(
            (item) =>
                typeof item === "object" &&
                item !== null &&
                !Array.isArray(item) &&
                Object.values(item).every((v) => typeof v === "string")
        )
    ) {
        return parsed as AppOptions["openInApp"];
    }
    return null;
}

function getDefaultOpenInApp(platform?: string): AppOptions["openInApp"] {
    if (platform === "darwin") return DEFAULT_MAC_OPEN_IN_APP;
    if (platform === "linux") return DEFAULT_LINUX_OPEN_IN_APP;
    return DEFAULT_OPEN_IN_APP;
}

export function OpenInAppSettings() {
    const { options, setOptions } = useApp();

    const platformDefaults = getDefaultOpenInApp(options.platform);

    const initialText = prettyJson(options.openInApp ?? []);
    const [text, setText] = useState(initialText);
    const [lastSavedText, setLastSavedText] = useState(initialText);

    const parsed = parseValue(text);
    const isJsonValid = parsed !== null;
    const isDirty = text !== lastSavedText;

    const handleSave = () => {
        if (!isDirty || !parsed) return;
        const reprettied = prettyJson(parsed);
        setText(reprettied);
        setLastSavedText(reprettied);
        setOptions((prev) => ({ ...prev, openInApp: parsed }));
    };

    const handleCancel = () => setText(lastSavedText);

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Open Slicer
                </h2>
                <p className="text-sm text-muted-foreground">
                    Configure external apps and the path used to launch them.
                </p>
            </div>

            <div className="group flex-1 space-y-2">
                <div className="flex h-4 items-center justify-between">
                    <span className="font-mono text-xs font-medium text-muted-foreground">
                        Record&lt;string, string&gt;[]
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="hidden h-auto px-2 py-0 text-2xs group-hover:flex"
                        onClick={() => setText(prettyJson(platformDefaults))}
                    >
                        Reset Defaults
                    </Button>
                </div>
                <InputGroup
                    className={cn(
                        !isJsonValid && "bg-background! opacity-100!"
                    )}
                >
                    <InputGroupTextarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className={cn(
                            "max-h-96 min-h-64 overflow-scroll font-mono text-xs break-all whitespace-pre-wrap",
                            !isJsonValid &&
                                "border-destructive focus-visible:ring-destructive"
                        )}
                        spellCheck={false}
                    />
                    <InputGroupAddon
                        align="block-end"
                        className="justify-between"
                    >
                        {!isJsonValid && (
                            <span className="text-2xs text-destructive">
                                Invalid JSON
                            </span>
                        )}
                        {isDirty && (
                            <div className="ml-auto flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={!isJsonValid}
                                >
                                    Save
                                </Button>
                            </div>
                        )}
                    </InputGroupAddon>
                </InputGroup>
                <p className="pt-1 text-muted-foreground">
                    <span className="font-bold text-destructive underline">
                        Warning
                    </span>
                    {": "}
                    The configured path will be executed on your system to
                    launch the application. Only include programs you trust and
                    verify the path carefully before saving, as incorrect or
                    malicious paths could execute unintended code. <br /> Ensure
                    the JSON is valid and does not contain trailing commas.
                </p>
            </div>
        </section>
    );
}
