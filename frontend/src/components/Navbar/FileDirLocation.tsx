import { FolderOpenIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import { Separator } from "@/shadcn/separator";

import { cn } from "@/lib/utils";

import { SpoolService } from "@bindings/services";

import { CopyOnClick } from "../CopyToClipboard";

export function FileDirLocation() {
    const [location, setLocation] = useState("");

    useEffect(() => {
        let mounted = true;

        const loadLocation = async () => {
            const dir = await SpoolService.GetDBDir();
            if (mounted) setLocation(dir);
        };

        loadLocation();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <div className="flex flex-col gap-2 rounded border border-border px-4 py-2">
            <div className="group flex items-center gap-4">
                <span className="text-xs font-medium tracking-widest text-nowrap text-muted-foreground/50 uppercase select-none">
                    App Path
                </span>
                <Separator orientation="vertical" className="my-2" />
                <CopyOnClick
                    textToCopy={location}
                    tooltipContent="Copy Path"
                    disabled={!location}
                >
                    <span className="font-mono text-xs tracking-wide break-all whitespace-pre-line text-foreground/80">
                        {location || "Loading..."}
                    </span>
                </CopyOnClick>
                <div className="ml-auto">
                    <LazyTooltip content="Open folder">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => SpoolService.OpenDBDir()}
                            className={cn(
                                "pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100",
                                !location && "pointer-events-none! opacity-60!"
                            )}
                            disabled={!location}
                        >
                            <FolderOpenIcon className="h-4 w-4" />
                        </Button>
                    </LazyTooltip>
                </div>
            </div>
            <Separator />

            <p className="text-xs text-muted-foreground">
                Modifying files in this folder may cause the application to
                malfunction.
            </p>
        </div>
    );
}
