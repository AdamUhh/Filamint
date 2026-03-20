import { InfoIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/shadcn/badge";
import { Button } from "@/shadcn/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/shadcn/button-group";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/shadcn/input-group";
import { Separator } from "@/shadcn/separator";

// Qualifiers are now string[] to support multiple values per key.
// e.g. vendor:gen* vendor:bamb* → { vendor: ["gen*", "bamb*"] }
function parseSearchQuery(search: string, qualifierKeys: string[]) {
    const qualifiers: Partial<Record<string, string[]>> = {};
    const freeTextParts: string[] = [];

    const tokens = search.trim().match(/\w+:"[^"]*"|\S+/g) ?? [];

    for (const token of tokens) {
        const colonIdx = token.indexOf(":");
        if (colonIdx > 0) {
            const key = token.slice(0, colonIdx).toLowerCase();
            let value = token.slice(colonIdx + 1);
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            if (qualifierKeys.includes(key) && value) {
                // Append to the existing array for this key, or start a new one
                qualifiers[key] = [...(qualifiers[key] ?? []), value];
                continue;
            }
        }
        if (token) freeTextParts.push(token);
    }

    return { qualifiers, freeText: freeTextParts.join(" ") };
}

// Rebuilds the search string from the current qualifier map + free text.
function rebuildSearchString(
    qualifiers: Partial<Record<string, string[]>>,
    freeText: string
): string {
    const parts = Object.entries(qualifiers).flatMap(([key, values]) =>
        // Each value becomes its own key:value token
        (values ?? []).map((value) => {
            const formatted = value.includes(" ") ? `"${value}"` : value;
            return `${key}:${formatted}`;
        })
    );
    if (freeText) parts.push(freeText);
    return parts.join(" ");
}

// Module-level constant — avoids recreating this JSX on every render (fix #7)
const DEFAULT_TOOLTIP_CONTENT = (
    <div className="space-y-1 tracking-wide">
        <p className="font-medium">Filter with qualifiers:</p>
        <p>spool: vendor: material: color:</p>

        <Separator className="bg-muted-foreground" />

        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
            <span className="font-medium">Wildcards:</span>
            <span>spool:PLA-*</span>

            <span className="font-medium">Quotes:</span>
            <span>vendor:"Bambu Lab"</span>

            <span className="font-medium">Mix freely:</span>
            <span>PLA vendor:Bambu*</span>

            <span className="font-medium">Multi-value:</span>
            <span>vendor:gen* vendor:bamb*</span>
        </div>

        <p className="text-xs text-background/70">
            Wildcards and quotes only work inside qualifiers.
        </p>
    </div>
);

export function AppSearch({
    onSearch,
    qualifierKeys = ["spool", "vendor", "material", "color"], // fix #2: optional
    placeholder = "Search Spools...",
    tooltipContent = DEFAULT_TOOLTIP_CONTENT,
}: {
    onSearch: (searchTerm: string) => void;
    qualifierKeys?: string[]; // fix #2: was required, now correctly optional
    placeholder?: string;
    tooltipContent?: React.ReactNode;
}) {
    const [inputValue, setInputValue] = useState("");

    // Memoized — only reruns when inputValue or qualifierKeys change (fix #8)
    const { qualifiers, freeText } = useMemo(
        () => parseSearchQuery(inputValue, qualifierKeys),
        [inputValue, qualifierKeys]
    );

    const hasQualifiers = Object.keys(qualifiers).length > 0;

    const handleSearch = () => onSearch(inputValue);

    const handleClear = () => {
        setInputValue("");
        onSearch("");
    };

    // Removes a single value from a qualifier; removes the key entirely if it
    // was the last value.
    const handleRemoveQualifier = (key: string, value: string) => {
        const next = { ...qualifiers };
        const remaining = (next[key] ?? []).filter((v) => v !== value);
        if (remaining.length > 0) {
            next[key] = remaining;
        } else {
            delete next[key];
        }
        const rebuilt = rebuildSearchString(next, freeText);
        setInputValue(rebuilt);
        onSearch(rebuilt);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSearch();
    };

    return (
        <div className="flex w-full max-w-md shrink-0 flex-col gap-1">
            <div className="flex items-center gap-2">
                <InputGroup>
                    <InputGroupAddon align="inline-start">
                        <SearchIcon className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                        type="text"
                        placeholder={placeholder}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <InputGroupAddon align="inline-end" className="pr-0">
                        <ButtonGroup>
                            {inputValue && (
                                <Button
                                    onClick={handleClear}
                                    variant="ghost"
                                    size="icon"
                                >
                                    <XIcon className="size-3.5" />
                                </Button>
                            )}
                            <ButtonGroupSeparator />
                            <Button
                                onClick={handleSearch}
                                variant="ghost"
                                className="px-2"
                            >
                                Search
                            </Button>
                        </ButtonGroup>
                    </InputGroupAddon>
                </InputGroup>
                <LazyTooltip content={tooltipContent}>
                    <InfoIcon className="size-4 text-muted-foreground" />
                </LazyTooltip>
            </div>

            <div className="relative">
                {hasQualifiers && (
                    <div className="absolute flex flex-wrap gap-1.5">
                        {Object.entries(qualifiers).flatMap(([key, values]) =>
                            // One badge per value — keys can now have multiple
                            (values ?? []).map((value) => (
                                <Badge
                                    // key is unique: a key can't hold duplicate values
                                    key={`${key}:${value}`}
                                    variant="secondary"
                                    className="overflow-hidden pr-0"
                                >
                                    <span className="text-muted-foreground">
                                        {key}:
                                    </span>
                                    <span>{value}</span>
                                    <Button
                                        onClick={() =>
                                            handleRemoveQualifier(key, value)
                                        }
                                        className="rounded-sm px-1 opacity-60 hover:opacity-100"
                                    >
                                        <XIcon className="size-3" />
                                    </Button>
                                </Badge>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
