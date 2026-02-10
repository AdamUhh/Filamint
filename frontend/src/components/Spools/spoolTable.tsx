import { useApp } from "@/context/useContext";
import { format } from "date-fns";
import {
    CheckIcon,
    ClipboardIcon,
    CopyPlusIcon,
    EllipsisIcon,
    FilePlusIcon,
    HistoryIcon,
    PencilIcon,
    TrashIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shadcn/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shadcn/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/tooltip";

import { cn } from "@/lib/utils";

import { Spool } from "@bindings";

export function SpoolTable({
    spools,
    templateOpen,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    spools: Map<number, Spool>;
    templateOpen: boolean;
    onEdit: (spool: Spool) => void;
    onDuplicate: (spool: Spool) => void;
    onDelete: (id: number) => void;
}) {
    const { options } = useApp();
    const spoolArray = Array.from(spools.values());

    return (
        <div className="rounded-lg border">
            <Table>
                <MyTableHeaders />
                <TableBody>
                    {spoolArray.length === 0 ? (
                        <MyTableRowsEmpty />
                    ) : (
                        spoolArray
                            .filter((spool) =>
                                templateOpen
                                    ? spool.isTemplate
                                    : !spool.isTemplate
                            )
                            .map((spool) => (
                                <TableRow key={spool.id} className="capitalize">
                                    <TableCell>
                                        {format(spool.updatedAt, "PPp")}
                                    </TableCell>
                                    <TableCell className="group flex items-center gap-2">
                                        <span>{spool.spoolCode}</span>
                                        <CopyToClipboard
                                            textToCopy={spool.spoolCode}
                                            tooltipContent="Copy Spool Code"
                                        />
                                    </TableCell>
                                    <TableCell>{spool.vendor}</TableCell>
                                    <TableCell>{spool.material}</TableCell>
                                    <TableCell>{spool.materialType}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {spool.colorHex && (
                                                <div
                                                    className="-mt-0.5 h-4 w-4 rounded shadow-[0_0_4px_0_#55555540]"
                                                    style={{
                                                        backgroundColor:
                                                            spool.colorHex,
                                                    }}
                                                />
                                            )}

                                            {spool.color}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {spool.totalWeight - spool.usedWeight}
                                    </TableCell>
                                    <TableCell>
                                        {options.currencyAlign === "left" ? (
                                            <>
                                                {options.currency} {spool.cost}
                                            </>
                                        ) : (
                                            <>
                                                {spool.cost} {options.currency}
                                            </>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                >
                                                    <EllipsisIcon className="pointer-events-none" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                className="w-40"
                                                align="start"
                                            >
                                                <DropdownMenuGroup>
                                                    <DropdownMenuLabel>
                                                        Actions
                                                    </DropdownMenuLabel>

                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            onDuplicate(spool)
                                                        }
                                                    >
                                                        <CopyPlusIcon className="mb-0.5" />
                                                        <span>Duplicate</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    <DropdownMenuLabel>
                                                        Prints
                                                    </DropdownMenuLabel>

                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            onEdit(spool)
                                                        }
                                                    >
                                                        <FilePlusIcon className="mb-0.5" />
                                                        <span>Log a print</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            onEdit(spool)
                                                        }
                                                    >
                                                        <HistoryIcon className="mb-0.5" />
                                                        <span>
                                                            View Print History
                                                        </span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>

                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    <DropdownMenuLabel>
                                                        Options
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            onEdit(spool)
                                                        }
                                                    >
                                                        <PencilIcon className="mb-0.5" />
                                                        <span>
                                                            Edit{" "}
                                                            {templateOpen
                                                                ? "Template"
                                                                : "Spool"}
                                                        </span>
                                                    </DropdownMenuItem>

                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            onDelete(spool.id)
                                                        }
                                                        variant="destructive"
                                                    >
                                                        <TrashIcon className="mb-0.5" />
                                                        <span>
                                                            Delete{" "}
                                                            {templateOpen
                                                                ? "Template"
                                                                : "Spool"}
                                                        </span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function MyTableRowsEmpty() {
    return (
        <TableRow>
            <TableCell
                colSpan={8}
                className="h-24 text-center text-muted-foreground"
            >
                No spools found. Add your first spool to get started.
            </TableCell>
        </TableRow>
    );
}

function MyTableHeaders() {
    return (
        <TableHeader>
            <TableRow>
                <TableHead>Last Updated</TableHead>
                <TableHead>Spool Code</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Remaining (g)</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead></TableHead>
            </TableRow>
        </TableHeader>
    );
}

function CopyToClipboard({
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
