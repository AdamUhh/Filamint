import { useEffect, useState } from "react";

import { Separator } from "@/shadcn/separator";

import { SpoolService } from "@bindings";

import { CopyToClipboard } from "../CopyToClipboard";

export function FileDirLocation() {
    const [location, setLocation] = useState("");

    useEffect(() => {
        const loadLocation = async () => {
            const dir = await SpoolService.GetDBDir();
            setLocation(dir);
        };

        loadLocation();
    }, []);

    return (
        <div className="group flex items-center gap-4 rounded border border-border px-4 py-2">
            <span className="text-xs font-medium tracking-widest text-nowrap text-muted-foreground/50 uppercase select-none">
                App Path
            </span>
            <Separator orientation="vertical" className="my-2" />
            <span className="font-mono text-xs tracking-wide break-all whitespace-pre-line text-foreground/80">
                {location}
            </span>
            <div className="ml-auto">
                <CopyToClipboard
                    textToCopy={location}
                    tooltipContent="Copy path"
                />
            </div>
        </div>
    );
}
