import { format } from "date-fns";
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    CopyPlusIcon,
    EllipsisIcon,
    PencilIcon,
    TrashIcon,
} from "lucide-react";

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

import type { Print, Spool } from "@bindings";

export function PrintTable({
    prints,
    spools,
    onEdit,
    onDuplicate,
    onDelete,
    isLoading,
    sortBy,
    sortOrder,
    onSort,
}: {
    prints: Map<number, Print>;
    spools: Map<number, Spool>;
    onEdit: (print: Print) => void;
    onDuplicate: (print: Print) => void;
    onDelete: (id: number) => void;
    isLoading?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onSort?: (column: string) => void;
}) {
    const printArray = Array.from(prints.values());

    return (
        <div className="rounded-lg border">
            <Table>
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
                            <TableRow key={print.id} className="capitalize">
                                <TableCell>{print.name}</TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        {print.spools?.map((ps, i) => {
                                            const _spool = spools.get(
                                                ps.spoolId
                                            );
                                            const colorHex =
                                                _spool?.colorHex || "#000000";

                                            const color =
                                                _spool?.color || "Black";

                                            return (
                                                <Tooltip key={i}>
                                                    <TooltipTrigger>
                                                        <div
                                                            key={ps.spoolId}
                                                            className="-mt-0.5 h-4 w-4 rounded shadow-[0_0_4px_0_#55555540]"
                                                            style={{
                                                                backgroundColor:
                                                                    colorHex,
                                                            }}
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {color} · {colorHex}
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {print.spools?.length
                                        ? print.spools
                                              .map((ps) => ps.gramsUsed || 0)
                                              .join(" / ") +
                                          ` (${print.spools.reduce((sum, ps) => sum + (ps.gramsUsed || 0), 0)})`
                                        : "NaN"}
                                </TableCell>
                                <TableCell>{print.status}</TableCell>
                                <TableCell>
                                    {print.datePrinted &&
                                        format(print.datePrinted, "PPp")}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
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
                                                        onDuplicate(print)
                                                    }
                                                >
                                                    <CopyPlusIcon className="mb-0.5" />
                                                    <span>Duplicate Print</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                            <DropdownMenuSeparator />

                                            <DropdownMenuGroup>
                                                <DropdownMenuLabel>
                                                    Options
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onEdit(print)
                                                    }
                                                >
                                                    <PencilIcon className="mb-0.5" />
                                                    <span>Edit Print</span>
                                                </DropdownMenuItem>

                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onDelete(print.id)
                                                    }
                                                    variant="destructive"
                                                >
                                                    <TrashIcon className="mb-0.5" />
                                                    <span>Delete Print</span>
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

// Helper component for sortable column headers
const SortableHeader = ({
    column,
    label,
    sortBy,
    sortOrder,
    onSort,
}: {
    column: string;
    label: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
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
        <TableHead>
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
        <TableHeader>
            <TableRow>
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
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="date_printed"
                    label="Printed On"
                />
                <TableHead></TableHead>
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
