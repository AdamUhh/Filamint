import { useApp } from "@/context/useContext";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import { Textarea } from "@/shadcn/textarea";

export function VendorSettings() {
    const { options, setOptions } = useApp();

    const [vendors, setVendors] = useState<string[]>(options.vendors ?? []);

    const isDirty = vendors !== options.vendors;

    const handleSave = () => {
        if (!isDirty) return;
        const trimmed = vendors
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
        setVendors(trimmed);
        setOptions((prev) => ({ ...prev, vendors: trimmed }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setVendors(e.target.value.split("\n"));
    };

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Vendors
                </h2>
                <p className="text-sm text-muted-foreground">
                    For autocomplete suggestions when creating a spool.
                </p>
                <p className="text-sm text-muted-foreground">
                    One vendor per line
                </p>
            </div>

            <Textarea
                value={(vendors ?? []).join("\n")}
                onChange={handleChange}
                rows={10}
                placeholder="One vendor per line..."
                className="font-mono text-sm"
            />

            {isDirty && <Button onClick={handleSave}>Save</Button>}
        </section>
    );
}
