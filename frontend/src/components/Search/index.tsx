import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/shadcn/badge";
import { Button } from "@/shadcn/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/shadcn/input-group";

const QUALIFIER_KEYS = ["spool", "vendor", "material", "color"] as const;
type QualifierKey = (typeof QUALIFIER_KEYS)[number];

function parseSearchQuery(search: string): {
    qualifiers: Partial<Record<QualifierKey, string>>;
    freeText: string;
} {
    const qualifiers: Partial<Record<QualifierKey, string>> = {};
    const freeTextParts: string[] = [];

    for (const token of search.trim().split(/\s+/)) {
        const colonIdx = token.indexOf(":");
        if (colonIdx > 0) {
            const key = token.slice(0, colonIdx).toLowerCase();
            const value = token.slice(colonIdx + 1);
            if (QUALIFIER_KEYS.includes(key as QualifierKey) && value) {
                qualifiers[key as QualifierKey] = value;
                continue;
            }
        }
        if (token) freeTextParts.push(token);
    }

    return { qualifiers, freeText: freeTextParts.join(" ") };
}

function rebuildSearchString(
    qualifiers: Partial<Record<QualifierKey, string>>,
    freeText: string
): string {
    const parts = Object.entries(qualifiers).map(
        ([key, value]) => `${key}:${value}`
    );
    if (freeText) parts.push(freeText);
    return parts.join(" ");
}

export function SpoolSearch({
    onSearch,
    placeholder = "Search spools by spool:  vendor:  material:  or  color:",
}: {
    onSearch: (searchTerm: string) => void;
    placeholder?: string;
}) {
    const [inputValue, setInputValue] = useState("");

    const { qualifiers, freeText } = parseSearchQuery(inputValue);
    const hasQualifiers = Object.keys(qualifiers).length > 0;

    const handleSearch = () => onSearch(inputValue);

    const handleClear = () => {
        setInputValue("");
        onSearch("");
    };

    const handleRemoveQualifier = (key: QualifierKey) => {
        const next = { ...qualifiers };
        delete next[key];
        const rebuilt = rebuildSearchString(next, freeText);
        setInputValue(rebuilt);
        onSearch(rebuilt);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSearch();
    };

    return (
        <div className="flex w-full max-w-md flex-col gap-2">
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
                <InputGroupAddon align="inline-end">
                    {inputValue && (
                        <Button
                            onClick={handleClear}
                            variant="ghost"
                            size="icon"
                        >
                            <XIcon className="size-4" />
                        </Button>
                    )}
                </InputGroupAddon>
                <InputGroupAddon align="inline-end" className="pr-1">
                    <Button
                        onClick={handleSearch}
                        variant="ghost"
                        className="px-4"
                    >
                        Search
                    </Button>
                </InputGroupAddon>
            </InputGroup>

            <div className="relative">
                {hasQualifiers && (
                    <div className="absolute flex flex-wrap gap-1.5">
                        {(
                            Object.entries(qualifiers) as [
                                QualifierKey,
                                string,
                            ][]
                        ).map(([key, value]) => (
                            <Badge
                                key={key + value}
                                variant="secondary"
                                className="overflow-hidden pr-0"
                            >
                                <span className="text-muted-foreground">
                                    {key}:
                                </span>
                                <span>{value}</span>
                                <Button
                                    onClick={() => handleRemoveQualifier(key)}
                                    className="rounded-sm px-1 opacity-60 hover:opacity-100"
                                >
                                    <XIcon className="size-3" />
                                </Button>
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
