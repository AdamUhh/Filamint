import { CheckIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/tooltip";

import { cn } from "@/lib/utils";

export function CopyToClipboard({
    textToCopy,
    tooltipContent,
}: {
    textToCopy: string;
    tooltipContent: string;
}) {
    const [copied, setCopied] = useState(false);
    const [open, setOpen] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setOpen(true);

        setTimeout(() => {
            setCopied(false);
            setOpen(false);
        }, 2000);
    };

    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    className={cn(
                        "pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100",
                        copied && "bg-green-500 hover:bg-green-500"
                    )}
                >
                    {copied ? (
                        <CheckIcon className="size-3.25" />
                    ) : (
                        <ClipboardIcon className="size-3.25" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {copied ? "Copied" : tooltipContent}
            </TooltipContent>
        </Tooltip>
    );
}
