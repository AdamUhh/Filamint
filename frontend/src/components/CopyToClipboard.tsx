import { CheckIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shadcn/button";

import { cn } from "@/lib/utils";

import { LazyTooltip } from "./ui/custom/lazy-tooltip";

export function CopyToClipboard({
    textToCopy,
    tooltipContent,
    disabled = false,
}: {
    textToCopy: string;
    tooltipContent: string;
    disabled?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const [open, setOpen] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setOpen(true);

        setTimeout(() => {
            setCopied(false);
            setOpen(false);
        }, 2000);
    };

    return (
        <LazyTooltip
            open={open}
            onOpenChange={setOpen}
            content={copied ? "Copied" : tooltipContent}
        >
            <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className={cn(
                    "pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100",
                    copied && "bg-green-500 hover:bg-green-500",
                    !disabled && "pointer-events-none!"
                )}
            >
                {copied ? (
                    <CheckIcon className="size-3.25" />
                ) : (
                    <ClipboardIcon className="size-3.25" />
                )}
            </Button>
        </LazyTooltip>
    );
}

export function CopyOnClick({
    textToCopy,
    tooltipContent,
    copiedContent,
    children,
    disabled = false,
}: {
    textToCopy: string;
    tooltipContent: React.ReactNode;
    copiedContent?: React.ReactNode;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const [open, setOpen] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setOpen(true);
        setTimeout(() => {
            setCopied(false);
            setOpen(false);
        }, 2000);
    };

    return (
        <LazyTooltip
            open={open}
            onOpenChange={setOpen}
            content={
                copied
                    ? (copiedContent ?? (
                          <div className="flex items-center gap-1">
                              <CheckIcon className="size-3.5" />
                              <span>Copied</span>
                          </div>
                      ))
                    : tooltipContent
            }
        >
            <div
                className={cn(
                    "hover:cursor-pointer",
                    disabled && "pointer-events-none!"
                )}
                onClick={handleCopy}
            >
                {children}
            </div>
        </LazyTooltip>
    );
}
