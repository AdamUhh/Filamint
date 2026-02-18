import { useApp } from "@/context/useContext";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupTextarea,
} from "@/shadcn/input-group";

export function MaterialSettings() {
    const { options, setOptions } = useApp();

    const [materials, setMaterials] = useState<string[]>(
        options.materials ?? []
    );

    const isDirty = materials !== options.materials;

    const handleSave = () => {
        if (!isDirty) return;
        const trimmed = materials
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
        setMaterials(trimmed);
        setOptions((prev) => ({ ...prev, materials: trimmed }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMaterials(e.target.value.split("\n"));
    };

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Materials
                </h2>
                <p className="text-sm text-muted-foreground">
                    For autocomplete suggestions when creating a spool.
                </p>
                <p className="text-sm text-muted-foreground">
                    One material per line
                </p>
            </div>

            <InputGroup>
                <InputGroupTextarea
                    value={(materials ?? []).join("\n")}
                    onChange={handleChange}
                    rows={8}
                    placeholder="One material per line..."
                    className="font-mono text-sm"
                />
                <InputGroupAddon align="block-end" className="justify-end">
                    {isDirty && <Button onClick={handleSave}>Save</Button>}
                </InputGroupAddon>
            </InputGroup>
        </section>
    );
}
