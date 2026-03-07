import { FolderOpenIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import { Separator } from "@/shadcn/separator";

import { SpoolService } from "@bindings";

import { CopyOnClick } from "../CopyToClipboard";

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
            <CopyOnClick textToCopy={location} tooltipContent="Copy Path">
                <span className="font-mono text-xs tracking-wide break-all whitespace-pre-line text-foreground/80">
                    {location}
                </span>
            </CopyOnClick>
            <div className="ml-auto">
                <LazyTooltip content="Open folder">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => SpoolService.OpenDBDir()}
                        className="pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
                    >
                        <FolderOpenIcon className="h-4 w-4" />
                    </Button>
                </LazyTooltip>
            </div>
        </div>
    );
}
