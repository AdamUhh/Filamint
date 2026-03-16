import type { Print } from "@bindings/services";
import { format } from "date-fns/format";
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    BoxIcon,
    CopyPlusIcon,
    EllipsisIcon,
    PencilIcon,
    RotateCwIcon,
    SquareArrowOutUpRightIcon,
    TrashIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/shadcn/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/shadcn/context-menu";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
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

import { CopyOnClick } from "../CopyToClipboard";
import { OpenInAppDialog } from "./OpenInApp";
import { ViewPrintDialog } from "./ViewPrint";
import { useInvalidatePrints } from "./lib/fetch-hooks";

export function PrintTable({
    prints,
    onEdit,
    onDuplicate,
    onDelete,
    isLoading,
    sortBy,
    sortOrder,
    onSort,
}: {
    prints: Map<number, Print>;
    onEdit: (print: Print) => void;
    onDuplicate: (print: Print) => void;
    onDelete: (id: number) => void;
    isLoading?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSort?: (column: string) => void;
}) {
    const printArray = Array.from(prints.values());

    const [viewState, setViewState] = useState<{
        printId: number | null;
        open: boolean;
    }>({
        printId: null,
        open: false,
    });

    const [openInAppState, setOpenInAppState] = useState<{
        printId: number | null;
        open: boolean;
    }>({
        printId: null,
        open: false,
    });

    const handleOpenInApp = (print: Print) => {
        setOpenInAppState({
            printId: print.id,
            open: true,
        });
    };

    const handleOnView = (print: Print) => {
        setViewState({
            printId: print.id,
            open: true,
        });
    };

    return (
        <>
            <div className="rounded-lg">
                <Table stickyHeader>
                    <PrintTableHeaders
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={onSort}
                    />
                    <TableBody>
                        {isLoading ? (
                            <PrintTableRowsLoading />
                        ) : printArray.length === 0 ? (
                            <PrintTableRowsEmpty />
                        ) : (
                            printArray.map((print) => (
                                <ContextMenu key={print.id}>
                                    <ContextMenuTrigger asChild>
                                        <TableRow className="capitalize">
                                            <TableCell>
                                                {print.datePrinted &&
                                                    format(
                                                        print.datePrinted,
                                                        "PPp"
                                                    )}
                                            </TableCell>
                                            <TableCell>{print.name}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {print.spools?.map(
                                                        (ps, i) => (
                                                            <CopyOnClick
                                                                key={i}
                                                                textToCopy={
                                                                    ps.spoolCode
                                                                }
                                                                tooltipContent={
                                                                    <div className="flex flex-col gap-1">
                                                                        <span>{`${ps.spoolCode} · ${ps.vendor} · ${ps.color} · ${ps.colorHex}`}</span>
                                                                        <span className="size-xs text-accent">
                                                                            Click
                                                                            to
                                                                            copy
                                                                            Spool
                                                                            Code
                                                                        </span>
                                                                    </div>
                                                                }
                                                            >
                                                                <div
                                                                    key={
                                                                        ps.spoolId
                                                                    }
                                                                    className="-mt-0.5 h-4 w-4 rounded shadow-[0_0_4px_0_#55555540] transition-transform hover:cursor-copy active:scale-90"
                                                                    style={{
                                                                        backgroundColor:
                                                                            ps.colorHex,
                                                                    }}
                                                                />
                                                            </CopyOnClick>
                                                        )
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {print.spools?.length
                                                    ? print.spools
                                                          .map(
                                                              (ps) =>
                                                                  ps.gramsUsed ||
                                                                  0
                                                          )
                                                          .join(" / ") +
                                                      ` (${print.spools.reduce((sum, ps) => sum + (ps.gramsUsed || 0), 0)})`
                                                    : "NaN"}
                                            </TableCell>
                                            <TableCell>
                                                {print.status}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
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
                                                                    handleOnView(
                                                                        print
                                                                    )
                                                                }
                                                            >
                                                                <SquareArrowOutUpRightIcon className="mb-0.5" />
                                                                <span>
                                                                    Open in...
                                                                </span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    handleOnView(
                                                                        print
                                                                    )
                                                                }
                                                            >
                                                                <BoxIcon className="mb-0.5" />
                                                                <span>
                                                                    View Print
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
                                                                    onDuplicate(
                                                                        print
                                                                    )
                                                                }
                                                            >
                                                                <CopyPlusIcon className="mb-0.5" />
                                                                <span>
                                                                    Duplicate
                                                                    Print
                                                                </span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    onEdit(
                                                                        print
                                                                    )
                                                                }
                                                            >
                                                                <PencilIcon className="mb-0.5" />
                                                                <span>
                                                                    Edit Print
                                                                </span>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    onDelete(
                                                                        print.id
                                                                    )
                                                                }
                                                                variant="destructive"
                                                            >
                                                                <TrashIcon className="mb-0.5" />
                                                                <span>
                                                                    Delete Print
                                                                </span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuGroup>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    </ContextMenuTrigger>

                                    <ContextMenuContent>
                                        <ContextMenuGroup>
                                            <ContextMenuLabel>
                                                Actions
                                            </ContextMenuLabel>

                                            <ContextMenuItem
                                                onSelect={() =>
                                                    handleOpenInApp(print)
                                                }
                                            >
                                                <SquareArrowOutUpRightIcon className="mb-0.5" />
                                                <span>Open in...</span>
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                onSelect={() =>
                                                    handleOnView(print)
                                                }
                                            >
                                                <BoxIcon className="mb-0.5" />
                                                <span>View Print</span>
                                            </ContextMenuItem>
                                        </ContextMenuGroup>
                                        <ContextMenuSeparator />

                                        <ContextMenuGroup>
                                            <ContextMenuLabel>
                                                Options
                                            </ContextMenuLabel>

                                            <ContextMenuItem
                                                onSelect={() =>
                                                    onDuplicate(print)
                                                }
                                            >
                                                <CopyPlusIcon className="mb-0.5" />
                                                <span>Duplicate Print</span>
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                onSelect={() => onEdit(print)}
                                            >
                                                <PencilIcon className="mb-0.5" />
                                                <span>Edit Print</span>
                                            </ContextMenuItem>

                                            <ContextMenuItem
                                                onSelect={() =>
                                                    onDelete(print.id)
                                                }
                                                variant="destructive"
                                            >
                                                <TrashIcon className="mb-0.5" />
                                                <span>Delete Print</span>
                                            </ContextMenuItem>
                                        </ContextMenuGroup>
                                    </ContextMenuContent>
                                </ContextMenu>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <OpenInAppDialog
                openInAppState={openInAppState}
                setOpenInAppState={setOpenInAppState}
            />
            <ViewPrintDialog
                viewState={viewState}
                setViewState={setViewState}
            />
        </>
    );
}

// Helper component for sortable column headers
const SortableHeader = ({
    column,
    label,
    sortBy,
    sortOrder,
    className,
    onSort,
}: {
    column: string;
    label: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    className?: string;
    onSort?: (column: string) => void;
}) => {
    if (!onSort) {
        return <TableHead>{label}</TableHead>;
    }

    const isActive = sortBy === column;
    const Icon = !isActive
        ? ArrowUpDownIcon
        : sortOrder === "desc"
          ? ArrowDownIcon
          : ArrowUpIcon;

    return (
        <TableHead className={className}>
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 hover:bg-accent"
                onClick={() => onSort(column)}
            >
                {label}
                <Icon className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );
};

function PrintTableHeaders({
    sortBy,
    sortOrder,
    onSort,
}: {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSort?: (column: string) => void;
}) {
    return (
        <TableHeader className="sticky top-0 bg-background">
            <TableRow>
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="date_printed"
                    label="Printed On"
                    className="w-48"
                />
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="name"
                    label="Name"
                />
                <TableHead>Spools</TableHead>
                <TableHead>Used (g)</TableHead>
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="status"
                    label="Status"
                />
                <TableHead className="w-12">
                    <RefreshPrints />
                </TableHead>
            </TableRow>
        </TableHeader>
    );
}

function PrintTableRowsLoading() {
    return (
        <TableRow>
            <TableCell
                colSpan={8}
                className="h-24 text-left text-muted-foreground"
            >
                Loading Prints...
            </TableCell>
        </TableRow>
    );
}

function PrintTableRowsEmpty() {
    return (
        <TableRow>
            <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
            >
                No prints found. Add your first print to get started.
            </TableCell>
        </TableRow>
    );
}

function RefreshPrints() {
    const { invalidate, isFetching, secondsLeft, isCoolingDown } =
        useInvalidatePrints();

    const tooltipText = isFetching
        ? "Refreshing..."
        : isCoolingDown
          ? `Retry in ${secondsLeft}s`
          : "Refresh Print Data";

    return (
        <LazyTooltip content={tooltipText}>
            <div>
                <Button
                    variant="ghost"
                    onClick={invalidate}
                    disabled={isFetching || isCoolingDown}
                >
                    <RotateCwIcon />
                </Button>
            </div>
        </LazyTooltip>
    );
}
