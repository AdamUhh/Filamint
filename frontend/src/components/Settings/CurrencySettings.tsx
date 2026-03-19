import { useApp } from "@/context/useContext";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import {
    Autocomplete,
    AutocompleteContent,
    AutocompleteEmpty,
    AutocompleteInput,
    AutocompleteItem,
    AutocompleteList,
} from "@/shadcn/custom/autocomplete";
import { Label } from "@/shadcn/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import { currencies } from "@/lib/constant-currency";

export function CurrencySettings() {
    const { options, setOptions } = useApp();
    const [currency, setCurrency] = useState(options.currency);
    const [currencyAlign, setCurrencyAlign] = useState(options.currencyAlign);

    const isDirty =
        currency !== options.currency ||
        currencyAlign !== options.currencyAlign;

    const handleSave = () => {
        if (!isDirty) return;
        setOptions((prev) => ({ ...prev, currency, currencyAlign }));
    };

    return (
        <section className="flex-1 space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Currency
                </h2>
                <p className="text-sm text-muted-foreground">
                    Configure how currency values are displayed.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-6">
                {/* Alignment */}
                <div className="flex flex-col gap-2">
                    <Label
                        htmlFor="currency_align"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Alignment
                    </Label>
                    <Select
                        value={currencyAlign}
                        onValueChange={(value) =>
                            setCurrencyAlign(value as "left" | "right")
                        }
                    >
                        <SelectTrigger id="currency_align" className="w-fit">
                            <SelectValue placeholder="Select alignment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Currency */}
                <div className="flex flex-col gap-2">
                    <Label
                        htmlFor="currency"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Currency
                    </Label>
                    <Autocomplete
                        name="currency"
                        items={currencies}
                        value={currency}
                        onValueChange={setCurrency}
                        openOnInputClick
                    >
                        <AutocompleteInput
                            id="currency"
                            placeholder="Search currency (e.g. USD)"
                            autoComplete="off"
                        />
                        <AutocompleteContent>
                            <AutocompleteEmpty>
                                No currency found.
                            </AutocompleteEmpty>
                            <AutocompleteList>
                                {(item: string) => (
                                    <AutocompleteItem key={item} value={item}>
                                        {item}
                                    </AutocompleteItem>
                                )}
                            </AutocompleteList>
                        </AutocompleteContent>
                    </Autocomplete>
                </div>
                {isDirty && <Button onClick={handleSave}>Save</Button>}
            </div>
        </section>
    );
}
