import { Events } from "@wailsio/runtime";
import { format } from "date-fns";
import {
    CopyPlusIcon,
    EllipsisIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/tooltip";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { type Print, PrintService } from "@bindings";

import { useAppForm } from "./form-hook";

const printSchema = z.object({
    name: z.string().min(1, "Name is required").max(300),
    spoolId: z.number().int().nonnegative(),
    gramsUsed: z.number().min(0, "Must be 0 or greater").max(10000),
    status: z.string().min(1).max(50),
    notes: z.string().max(2000),

    datePrinted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timePrinted: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),

    // TODO: Print file(s)
});
export function PrintsPage() {
    const [prints, setPrints] = useState<Print[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number>(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [printToDelete, setPrintToDelete] = useState<number | null>(null);
    const [originalPrint, setOriginalPrint] = useState<Print | null>(null);

    const fetchPrints = async () => {
        try {
            const list = await PrintService.ListPrints();
            setPrints(list);
        } catch (err) {
            console.error("Failed to fetch prints:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrints();
    }, []);

    const form = useAppForm({
        defaultValues: {
            name: "",
            spoolId: 0,
            gramsUsed: 0,
            status: "completed",
            notes: "",
            datePrinted: format(new Date(), "yyyy-MM-dd"),
            timePrinted: format(new Date(), "HH:mm:ss"),
        },
        validators: { onChange: printSchema },
        onSubmit: async ({ value }) => {
            const now = new Date().toISOString();
            const dateTime = new Date(
                `${value.datePrinted}T${value.timePrinted}`
            ).toISOString();

            const printToSave: Print = {
                id: editingId,
                ...value,
                datePrinted: dateTime,
                createdAt:
                    editingId > 0
                        ? prints.find((s) => s.id === editingId)?.createdAt ||
                          now
                        : now,
                updatedAt: now,
            };

            try {
                if (editingId > 0) {
                    await PrintService.UpdatePrint(printToSave);
                } else {
                    await PrintService.CreatePrint(printToSave);
                }
                setEditDialogOpen(false);
                form.reset();
                fetchPrints();
            } catch (err) {
                console.error("Failed to save print:", err);
            }
        },
    });

    const resetToOriginal = (field: keyof Print) => {
        if (!originalPrint) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setFieldValue(field as any, originalPrint[field]);
    };

    const handleCreate = useCallback(() => {
        setEditingId(0);
        form.reset();
        setEditDialogOpen(true);
    }, [form]);

    useEffect(() => {
        Events.On("print:create", handleCreate);

        return () => {
            Events.Off("print:create");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEdit = (print: Print) => {
        setEditingId(print.id);
        setOriginalPrint(print);

        form.setFieldValue("name", print.name);
        form.setFieldValue("spoolId", print.spoolId);
        form.setFieldValue("gramsUsed", print.gramsUsed);
        form.setFieldValue("status", print.status);
        form.setFieldValue("notes", print.notes);

        const d = new Date(print.datePrinted);
        form.setFieldValue("datePrinted", format(d, "yyyy-MM-dd"));
        form.setFieldValue("timePrinted", format(d, "HH:mm:ss"));

        setEditDialogOpen(true);
    };

    const handleDuplicate = (print: Print) => {
        setEditingId(0);
        setOriginalPrint(print);

        form.setFieldValue("name", print.name);
        form.setFieldValue("spoolId", print.spoolId);
        form.setFieldValue("gramsUsed", print.gramsUsed);
        form.setFieldValue("status", print.status);
        form.setFieldValue("notes", print.notes);

        const d = new Date(print.datePrinted);
        form.setFieldValue("datePrinted", format(d, "yyyy-MM-dd"));
        form.setFieldValue("timePrinted", format(d, "HH:mm:ss"));

        setEditDialogOpen(true);
    };

    const handleDelete = (id: number) => {
        setPrintToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (printToDelete === null) return;
        try {
            await PrintService.DeletePrint(printToDelete);
            fetchPrints();
        } catch (err) {
            console.error(err);
        } finally {
            setDeleteDialogOpen(false);
            setPrintToDelete(null);
        }
    };

    if (loading) return <p className="p-6">Loading prints...</p>;

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Prints</h1>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={handleCreate}>
                            <PlusIcon /> Add Print
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Ctrl + N</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="rounded-lg border">
                <Table>
                    <MyTableHeaders />
                    <MyTableBody
                        prints={prints}
                        onEdit={handleEdit}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                    />
                </Table>
            </div>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId > 0 ? "Edit Print" : "Add New Print"}
                        </DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                    >
                        <FieldGroup className="pb-4">
                            <form.AppField
                                name="name"
                                children={(field) => (
                                    <field.PrintNameFormField
                                        editingId={editingId}
                                        onReset={resetToOriginal}
                                    />
                                )}
                            />

                            <form.AppField
                                name="gramsUsed"
                                children={(field) => (
                                    <field.PrintGramsUsedFormField
                                        editingId={editingId}
                                        onReset={resetToOriginal}
                                    />
                                )}
                            />

                            <FieldGroup className="flex-row gap-2">
                                <form.AppField
                                    name="datePrinted"
                                    children={(field) => (
                                        <field.PrintCalendarFormField
                                            editingId={editingId}
                                            onReset={resetToOriginal}
                                        />
                                    )}
                                />

                                <form.AppField
                                    name="timePrinted"
                                    children={(field) => (
                                        <field.PrintTimeFormField
                                            editingId={editingId}
                                            onReset={resetToOriginal}
                                        />
                                    )}
                                />
                            </FieldGroup>
                            <form.AppField
                                name="status"
                                children={(field) => (
                                    <field.PrintStatusFormField
                                        editingId={editingId}
                                        onReset={resetToOriginal}
                                    />
                                )}
                            />
                        </FieldGroup>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingId > 0 ? "Update" : "Create"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert Dialog */}
            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the print.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function MyTableBody({
    prints,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    prints: Print[];
    onEdit: (print: Print) => void;
    onDuplicate: (print: Print) => void;
    onDelete: (id: number) => void;
}) {
    return (
        <TableBody>
            {prints.length === 0 ? (
                <MyTableRowsEmpty />
            ) : (
                prints.map((print) => (
                    <TableRow key={print.id} className="capitalize">
                        <TableCell>{print.name}</TableCell>
                        <TableCell>{print.spoolId}</TableCell>
                        <TableCell>{print.gramsUsed}</TableCell>
                        <TableCell>{print.status}</TableCell>
                        <TableCell>
                            {format(
                                print.datePrinted,
                                "MMM d, yyyy hh:mm:ss a"
                            )}
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
                                            onSelect={() => onDuplicate(print)}
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
                                            onSelect={() => onEdit(print)}
                                        >
                                            <PencilIcon className="mb-0.5" />
                                            <span>Edit Print</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            onSelect={() => onDelete(print.id)}
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
    );
}

function MyTableRowsEmpty() {
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

function MyTableHeaders() {
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
