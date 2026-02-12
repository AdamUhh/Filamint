import { useApp } from "@/context/useContext";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import { Label } from "@/components/ui/label";

export function CurrencySettings() {
    const { options, setOptions } = useApp();

    return (
        <section className="space-y-3">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Currency
                </h2>
                <p className="text-sm text-muted-foreground">
                    Configure how currency values are displayed.
                </p>
            </div>

            <div className="flex flex-wrap gap-6">
                <div className="flex flex-col gap-1">
                    <Label
                        htmlFor="currency"
                        className="text-xs font-medium text-muted-foreground"
                    >
                        Currency
                    </Label>
                    <Select
                        value={options.currency}
                        onValueChange={(value) =>
                            setOptions((prev) => ({
                                ...prev,
                                currency: value,
                            }))
                        }
                    >
                        <SelectTrigger id="currency" className="w-full sm:w-40">
                            <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="AED">AED</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Alignment */}
                <div className="flex flex-col gap-1">
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
                        <SelectTrigger
                            id="currency_align"
                            className="w-full sm:w-40"
                        >
                            <SelectValue placeholder="Select alignment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </section>
    );
}
