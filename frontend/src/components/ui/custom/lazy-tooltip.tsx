"use client";

import { useState } from "react";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function LazyTooltip({
    children,
    content,
    asChild = true,
    open,
    onOpenChange,
}: {
    children: React.ReactElement;
    content: React.ReactNode;
    asChild?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [enabled, setEnabled] = useState(false);

    const triggerProps = {
        onPointerEnter: () => setEnabled(true),
        onTouchStart: () => setEnabled(true),
    } as const;

    const isEnabled = enabled || open === true;

    if (!isEnabled) {
        return {
            ...children,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props: { ...(children.props as any), ...triggerProps },
        };
    }

    return (
        <Tooltip open={open} onOpenChange={onOpenChange}>
            <TooltipTrigger asChild={asChild}>
                {{
                    ...children,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    props: { ...(children.props as any), ...triggerProps },
                }}
            </TooltipTrigger>
            <TooltipContent>{content}</TooltipContent>
        </Tooltip>
    );
}
