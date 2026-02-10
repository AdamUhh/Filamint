import { format } from "date-fns";
import {
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

import type { Print } from "@bindings";

export function PrintTable({
    prints,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    prints: Map<number, Print>;
    onEdit: (print: Print) => void;
    onDuplicate: (print: Print) => void;
    onDelete: (id: number) => void;
}) {
    const printArray = Array.from(prints.values());

    return (
        <div className="rounded-lg border">
            <Table>
                <PrintTableHeaders />
                <TableBody>
                    {printArray.length === 0 ? (
                        <PrintTableRowsEmpty />
                    ) : (
                        printArray.map((print) => (
                            <TableRow key={print.id} className="capitalize">
                                <TableCell>{print.name}</TableCell>
                                <TableCell>spoolId</TableCell>
                                <TableCell>NaN</TableCell>
                                <TableCell>{print.status}</TableCell>
                                <TableCell>
                                    {format(print.datePrinted, "PPp")}
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

function PrintTableHeaders() {
    return (
        <TableHeader>
            <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Spool</TableHead>
                <TableHead>Used (g)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Printed On</TableHead>
                <TableHead></TableHead>
            </TableRow>
        </TableHeader>
    );
}

function PrintTableRowsEmpty() {
    return (
        <TableRow>
            <TableCell
                colSpan={8}
                className="h-24 text-center text-muted-foreground"
            >
                No prints found. Add your first print to get started.
            </TableCell>
        </TableRow>
    );
}
