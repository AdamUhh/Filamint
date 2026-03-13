import { useApp } from "@/context/useContext";
import { format } from "date-fns/format";
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    CopyPlusIcon,
    EllipsisIcon,
    FilePlusIcon,
    PencilIcon,
    RotateCwIcon,
    TrashIcon,
} from "lucide-react";

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

import type { Spool } from "@bindings";

import { CopyToClipboard } from "../CopyToClipboard";
import { useInvalidateSpools } from "./lib/fetch-hooks";

export function SpoolTable({
    spools,
    isLoading,
    templateOpen,
    sortBy,
    sortOrder,
    onEdit,
    onDuplicate,
    onLogAPrint,
    onDelete,
    onSort,
}: {
    spools: Map<number, Spool>;
    isLoading: boolean;
    templateOpen: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onEdit: (spool: Spool) => void;
    onDuplicate: (spool: Spool) => void;
    onLogAPrint: (spool: Spool) => void;
    onDelete: (id: number) => void;
    onSort?: (column: string) => void;
}) {
    const { options } = useApp();
    const spoolArray = Array.from(spools.values());

    return (
        <div className="rounded-lg border">
            <Table className="table-fixed">
                <MyTableHeaders
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                />
                <TableBody>
                    {isLoading ? (
                        <MyTableRowsLoading />
                    ) : spoolArray.length === 0 ? (
                        <MyTableRowsEmpty />
                    ) : (
                        spoolArray
                            .filter((spool) =>
                                templateOpen
                                    ? spool.isTemplate
                                    : !spool.isTemplate
                            )
                            .map((spool) => (
                                <ContextMenu key={spool.id}>
                                    <ContextMenuTrigger asChild>
                                        <TableRow className="capitalize">
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
                                            <TableCell>
                                                {spool.vendor}
                                            </TableCell>
                                            <TableCell>
                                                {spool.material}
                                            </TableCell>
                                            <TableCell>
                                                {spool.materialType}
                                            </TableCell>
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
                                                {spool.totalWeight -
                                                    spool.usedWeight}
                                            </TableCell>
                                            <TableCell>
                                                {options.currencyAlign ===
                                                "left" ? (
                                                    <>
                                                        {options.currency}{" "}
                                                        {spool.cost}
                                                    </>
                                                ) : (
                                                    <>
                                                        {spool.cost}{" "}
                                                        {options.currency}
                                                    </>
                                                )}
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
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuGroup>
                                                            <DropdownMenuLabel>
                                                                Prints
                                                            </DropdownMenuLabel>

                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    onDuplicate(
                                                                        spool
                                                                    )
                                                                }
                                                            >
                                                                <CopyPlusIcon className="mb-0.5" />
                                                                <span>
                                                                    Duplicate
                                                                </span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    onLogAPrint(
                                                                        spool
                                                                    )
                                                                }
                                                            >
                                                                <FilePlusIcon className="mb-0.5" />
                                                                <span>
                                                                    Log a print
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
                                                                    onEdit(
                                                                        spool
                                                                    )
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
                                                                    onDelete(
                                                                        spool.id
                                                                    )
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
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                        <ContextMenuSeparator />
                                        <ContextMenuGroup>
                                            <ContextMenuLabel>
                                                Prints
                                            </ContextMenuLabel>

                                            <ContextMenuItem
                                                onSelect={() =>
                                                    onLogAPrint(spool)
                                                }
                                            >
                                                <FilePlusIcon className="mb-0.5" />
                                                <span>Log a print</span>
                                            </ContextMenuItem>
                                        </ContextMenuGroup>

                                        <ContextMenuSeparator />
                                        <ContextMenuGroup>
                                            <ContextMenuLabel>
                                                Options
                                            </ContextMenuLabel>
                                            <ContextMenuItem
                                                onSelect={() =>
                                                    onDuplicate(spool)
                                                }
                                            >
                                                <CopyPlusIcon className="mb-0.5" />
                                                <span>Duplicate</span>
                                            </ContextMenuItem>

                                            <ContextMenuItem
                                                onSelect={() => onEdit(spool)}
                                            >
                                                <PencilIcon className="mb-0.5" />
                                                <span>
                                                    Edit{" "}
                                                    {templateOpen
                                                        ? "Template"
                                                        : "Spool"}
                                                </span>
                                            </ContextMenuItem>

                                            <ContextMenuItem
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
                                            </ContextMenuItem>
                                        </ContextMenuGroup>
                                    </ContextMenuContent>
                                </ContextMenu>
                            ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function MyTableRowsLoading() {
    return (
        <TableRow>
            <TableCell
                colSpan={8}
                className="h-24 text-left text-muted-foreground"
            >
                Loading Spools...
            </TableCell>
        </TableRow>
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

const SortableHeader = ({
    column,
    label,
    onSort,
    sortBy,
    sortOrder,
    className,
}: {
    column: string;
    label: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSort?: (column: string) => void;
    className?: string;
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

function MyTableHeaders({
    sortBy,
    sortOrder,
    onSort,
}: {
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSort?: (column: string) => void;
}) {
    return (
        <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="updated_at"
                    label="Last Updated"
                    className="w-48"
                />
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="spool_code"
                    label="Spool Code"
                    className="w-40"
                />
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="vendor"
                    label="Vendor"
                    className="w-36"
                />
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="material"
                    label="Material"
                    className="w-36"
                />
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="material_type"
                    label="Type"
                    className="w-36"
                />
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="color"
                    label="Color"
                    className="w-36"
                />
                <TableHead className="w-36">Remaining (g)</TableHead>
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="cost"
                    label="Cost"
                    className="w-36"
                />
                <TableHead className="w-12">
                    <RefreshSpools />
                </TableHead>
            </TableRow>
        </TableHeader>
    );
}

function RefreshSpools() {
    const { invalidate, isFetching, secondsLeft, isCoolingDown } =
        useInvalidateSpools();

    const tooltipText = isFetching
        ? "Refreshing..."
        : isCoolingDown
          ? `Retry in ${secondsLeft}s`
          : "Refresh Spool Data";

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
