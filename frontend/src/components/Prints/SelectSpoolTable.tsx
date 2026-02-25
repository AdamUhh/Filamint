import { useApp } from "@/context/useContext";
import type { UpdateMetaOptions } from "@tanstack/react-form";
import { format } from "date-fns";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

import { Button } from "@/shadcn/button";
import { Checkbox } from "@/shadcn/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shadcn/table";

import { cn } from "@/lib/utils";

import type { PrintSpool, Spool } from "@bindings";

import { CopyToClipboard } from "../CopyToClipboard";

export function SelectSpoolTable({
    editingId,
    value,
    spools,
    isLoading,
    sortBy,
    sortOrder,
    onAdd,
    onDelete,
    onSort,
}: {
    editingId: number;
    value: PrintSpool["spoolId"][] | undefined;
    spools: Map<number, Spool>;
    isLoading: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    onAdd: (value: PrintSpool, options?: UpdateMetaOptions) => void;
    onDelete: (id: number) => void;
    onSort?: (column: string) => void;
}) {
    const { options } = useApp();
    const spoolArray = Array.from(spools.values());

    const handleCheckbox = (id: number, spool: Spool) => {
        // already added
        if (value?.includes(id)) {
            const indx = value?.findIndex((s) => s === id);
            onDelete(indx);
        } else {
            onAdd({
                id: editingId,
                printId: editingId,
                spoolId: spool.id,
                gramsUsed: 0,

                createdAt: spool.createdAt,
                updatedAt: spool.updatedAt,

                spoolCode: spool.spoolCode,
                vendor: spool.vendor,
                material: spool.material,
                color: spool.color,
                colorHex: spool.colorHex,
            });
        }
    };

    return (
        <div className="h-[calc(90vh-150px)] rounded-lg border">
            <Table>
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
                        spoolArray.map((spool) => (
                            <TableRow
                                key={spool.id}
                                className={cn(
                                    "capitalize",
                                    value?.includes(spool.id) && "bg-blue-50"
                                )}
                            >
                                <TableCell>
                                    <Checkbox
                                        checked={value?.includes(spool.id)}
                                        onClick={() =>
                                            handleCheckbox(spool.id, spool)
                                        }
                                    />
                                </TableCell>
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
                            </TableRow>
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
                <TableHead />
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
                <TableHead>Remaining (g)</TableHead>
                <SortableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    column="cost"
                    label="Cost"
                />
            </TableRow>
        </TableHeader>
    );
}
