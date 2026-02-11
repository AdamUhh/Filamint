import { useApp } from "@/context/useContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";

import { Label } from "@/components/ui/label";

import { ShortcutsSettingsSimple } from "./ShortcutSettings";

export function AppSettings() {
    const { options, setOptions } = useApp();

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Currency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select
                            value={options.currency}
                            onValueChange={(value) =>
                                setOptions((prev) => ({
                                    ...prev,
                                    currency: value,
                                }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AED">AED</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Currency Alignment</Label>
                        <Select
                            value={options.currencyAlign}
                            onValueChange={(value: "left" | "right") =>
                                setOptions((prev) => ({
                                    ...prev,
                                    currencyAlign: value,
                                }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            <ShortcutsSettingsSimple />
        </div>
    );
}
