import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/shadcn/input-group";

interface SearchProps {
    onSearch: (searchTerm: string) => void;
    placeholder?: string;
}

export function SpoolSearch({
    onSearch,
    placeholder = "Search spools by code, vendor, material, or color...",
}: SearchProps) {
    const [inputValue, setInputValue] = useState("");

    const handleSearch = () => {
        onSearch(inputValue);
    };

    const handleClear = () => {
        setInputValue("");
        onSearch("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    return (
        <div className="flex w-full max-w-md gap-2">
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
        </div>
    );
}
