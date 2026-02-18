import { useApp } from "@/context/useContext";
import { useState } from "react";

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

    // Determine if there is a change
    const isDirty = currency !== options.currency;

    const handleSave = () => {
        if (!isDirty) return; // No-op if nothing changed
        setOptions((prev) => ({
            ...prev,
            currency,
        }));
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
                        value={options.currencyAlign}
                        onValueChange={(value: "left" | "right") =>
                            setOptions((prev) => ({
                                ...prev,
                                currencyAlign: value,
                            }))
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
                        onValueChange={(value: string) => setCurrency(value)}
                        openOnInputClick
                    >
                        <div className="flex items-end">
                            <AutocompleteInput
                                id="currency"
                                placeholder="Search currency (e.g. USD)"
                                autoComplete="off"
                                showSave={isDirty}
                                onSave={handleSave}
                            />
                        </div>
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
            </div>
        </section>
    );
}
