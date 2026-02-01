import {
    CopyPlusIcon,
    EllipsisIcon,
    FilePlusIcon,
    HistoryIcon,
    MenuIcon,
    PencilIcon,
    PlusIcon,
    StarIcon,
    TrashIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

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
import { ButtonGroup } from "@/components/ui/button-group";
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

import { Spool, SpoolService } from "@bindings";

import { useAppForm } from "./form-hook";

const spoolSchema = z.object({
    vendor: z.string().min(1, "Vendor is required").max(100),
    material: z.string().min(1, "Material is required").max(100),
    materialType: z.string().min(1, "Material type is required").max(100),
    color: z.string().min(1, "Color is required").max(100),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
    totalWeight: z.number().min(0, "Must be 0 or greater").max(10000),
    usedWeight: z.number().min(0, "Must be 0 or greater").max(10000),
    cost: z.number().min(0, "Must be 0 or greater").max(1_000_000_000), // 1 billion, _ improves readability
    referenceLink: z.url("Invalid URL").or(z.literal("")),
    notes: z.string().max(2000),
    isTemplate: z.boolean(),
});

export function SpoolsPage() {
    const [spools, setSpools] = useState<Spool[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [editingId, setEditingId] = useState<number>(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [spoolToDelete, setSpoolToDelete] = useState<number | null>(null);
    const [originalSpool, setOriginalSpool] = useState<Spool | null>(null);

    const fetchSpools = async () => {
        try {
            const list = await SpoolService.ListSpools();
            setSpools(list);
        } catch (err) {
            console.error("Failed to fetch spools:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSpools();
    }, []);

    const form = useAppForm({
        defaultValues: {
            vendor: "",
            material: "",
            materialType: "",
            color: "",
            colorHex: "#000000",
            totalWeight: 0,
            usedWeight: 0,
            cost: 0,
            referenceLink: "",
            notes: "",
            isTemplate: false,
        },
        validators: { onChange: spoolSchema },
        onSubmit: async ({ value }) => {
            const now = new Date().toISOString();
            const spoolToSave: Spool = {
                id: editingId,
                ...value,
                firstUsedAt: null,
                lastUsedAt: null,
                createdAt:
                    editingId > 0
                        ? spools.find((s) => s.id === editingId)?.createdAt ||
                          now
                        : now,
                updatedAt: now,
            };

            try {
                if (editingId > 0) {
                    await SpoolService.UpdateSpool(spoolToSave);
                } else {
                    await SpoolService.CreateSpool(spoolToSave);
                }
                setEditDialogOpen(false);
                form.reset();
                fetchSpools();
            } catch (err) {
                console.error("Failed to save spool:", err);
            }
        },
    });

    const handleDeleteClick = (id: number) => {
        setSpoolToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (spoolToDelete === null) return;
        try {
            await SpoolService.DeleteSpool(spoolToDelete);
            fetchSpools();
        } catch (err) {
            console.error(err);
        } finally {
            setDeleteDialogOpen(false);
            setSpoolToDelete(null);
        }
    };

    const handleViewTemplate = () => {
        setTemplateOpen((prev) => !prev);
    };

    const handleAddNew = () => {
        setEditingId(0);
        form.reset();
        setEditDialogOpen(true);
    };

    const resetToOriginal = (field: keyof Spool) => {
        if (!originalSpool) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setFieldValue(field as any, originalSpool[field]);
    };

    const handleEdit = (spool: Spool) => {
        setEditingId(spool.id);
        setOriginalSpool(spool);

        form.setFieldValue("vendor", spool.vendor);
        form.setFieldValue("material", spool.material);
        form.setFieldValue("materialType", spool.materialType);
        form.setFieldValue("color", spool.color);
        form.setFieldValue("colorHex", spool.colorHex || "#000000");
        form.setFieldValue("totalWeight", spool.totalWeight);
        form.setFieldValue("usedWeight", spool.usedWeight);
        form.setFieldValue("cost", spool.cost);
        form.setFieldValue("referenceLink", spool.referenceLink);
        form.setFieldValue("notes", spool.notes);
        form.setFieldValue("isTemplate", spool.isTemplate);

        setEditDialogOpen(true);
    };

    if (loading) return <p className="p-6">Loading spools...</p>;

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">
                    Filament Spools {templateOpen && "- Templates"}
                </h1>
                <ButtonGroup>
                    <Button variant="outline" onClick={handleViewTemplate}>
                        {templateOpen ? (
                            <>
                                <MenuIcon />
                                Back to Spools
                            </>
                        ) : (
                            <>
                                <StarIcon /> View Templates
                            </>
                        )}
                    </Button>
                    <Button onClick={handleAddNew}>
                        <PlusIcon /> Add Spool
                    </Button>
                </ButtonGroup>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <MyTableHeaders />
                    <MyTableBody
                        spools={spools}
                        templateOpen={templateOpen}
                        handleEdit={handleEdit}
                        handleDeleteClick={handleDeleteClick}
                    />
                </Table>
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId > 0 ? "Edit Spool" : "Add New Spool"}
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
                                name="vendor"
                                children={(field) => (
                                    <field.SpoolVendorFormField
                                        editingId={editingId}
                                        resetToOriginal={resetToOriginal}
                                    />
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <form.AppField
                                    name="material"
                                    children={(field) => (
                                        <field.SpoolMaterialFormField
                                            editingId={editingId}
                                            resetToOriginal={resetToOriginal}
                                        />
                                    )}
                                />

                                <form.AppField
                                    name="materialType"
                                    children={(field) => (
                                        <field.SpoolMaterialFormField
                                            editingId={editingId}
                                            resetToOriginal={resetToOriginal}
                                        />
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.AppField
                                    name="color"
                                    children={(field) => (
                                        <field.SpoolColorFormField
                                            editingId={editingId}
                                            resetToOriginal={resetToOriginal}
                                        />
                                    )}
                                />

                                <form.AppField
                                    name="colorHex"
                                    children={(field) => (
                                        <field.SpoolColorHexFormField
                                            editingId={editingId}
                                            resetToOriginal={resetToOriginal}
                                        />
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.AppField
                                    name="totalWeight"
                                    children={(field) => (
                                        <field.SpoolTotalWeightFormField
                                            editingId={editingId}
                                            resetToOriginal={resetToOriginal}
                                        />
                                    )}
                                />

                                <form.AppField
                                    name="usedWeight"
                                    children={(field) => (
                                        <field.SpoolUsedWeightFormField
                                            editingId={editingId}
                                            resetToOriginal={resetToOriginal}
                                        />
                                    )}
                                />
                            </div>

                            <form.AppField
                                name="cost"
                                children={(field) => (
                                    <field.SpoolCostFormField
                                        editingId={editingId}
                                        resetToOriginal={resetToOriginal}
                                    />
                                )}
                            />

                            <form.AppField
                                name="referenceLink"
                                children={(field) => (
                                    <field.SpoolReferenceLinkFormField
                                        editingId={editingId}
                                        resetToOriginal={resetToOriginal}
                                    />
                                )}
                            />

                            <form.AppField
                                name="notes"
                                children={(field) => (
                                    <field.SpoolNotesFormField
                                        editingId={editingId}
                                        resetToOriginal={resetToOriginal}
                                    />
                                )}
                            />

                            <form.AppField
                                name="isTemplate"
                                children={(field) => (
                                    <field.SpoolIsTemplateFormField />
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
                            delete the spool.
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
    spools,
    templateOpen,
    handleEdit,
    handleDeleteClick,
}: {
    spools: Spool[];
    templateOpen: boolean;
    handleEdit: (spool: Spool) => void;
    handleDeleteClick: (id: number) => void;
}) {
    return (
        <TableBody>
            {spools.length === 0 ? (
                <MyTableRowsEmpty />
            ) : (
                spools
                    .filter((spool) =>
                        templateOpen ? spool.isTemplate : !spool.isTemplate
                    )
                    .map((spool) => (
                        <TableRow key={spool.id}>
                            <TableCell>{spool.vendor}</TableCell>
                            <TableCell>{spool.material}</TableCell>
                            <TableCell>{spool.materialType}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {spool.colorHex && (
                                        <div
                                            className="-mt-0.5 h-4 w-4 rounded"
                                            style={{
                                                backgroundColor: spool.colorHex,
                                            }}
                                        />
                                    )}

                                    {spool.color}
                                </div>
                            </TableCell>
                            <TableCell>{spool.totalWeight}</TableCell>
                            <TableCell>{spool.usedWeight}</TableCell>
                            <TableCell>AED {spool.cost}</TableCell>
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
                                                    handleEdit(spool)
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
                                                    handleEdit(spool)
                                                }
                                            >
                                                <FilePlusIcon className="mb-0.5" />
                                                <span>Log a print</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    handleEdit(spool)
                                                }
                                            >
                                                <HistoryIcon className="mb-0.5" />
                                                <span>View Print History</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuGroup>
                                            <DropdownMenuLabel>
                                                Options
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    handleEdit(spool)
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
                                                    handleDeleteClick(spool.id)
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
                <TableHead>Vendor</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Remaining (g)</TableHead>
                <TableHead>Used (g)</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead></TableHead>
            </TableRow>
        </TableHeader>
    );
}
