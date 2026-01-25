import { useForm } from "@tanstack/react-form";
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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { Spool, SpoolService } from "@bindings";

const spoolSchema = z.object({
    vendor: z.string().min(1, "Vendor is required"),
    material: z.string().min(1, "Material is required"),
    materialType: z.string().min(1, "Material type is required"),
    color: z.string().min(1, "Color is required"),
    colorRGB: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
    totalWeight: z.number().min(0, "Must be 0 or greater"),
    usedWeight: z.number().min(0, "Must be 0 or greater"),
    cost: z.number().min(0, "Must be 0 or greater"),
    referenceLink: z.string().url("Invalid URL").or(z.literal("")),
    notes: z.string(),
});

export default function SpoolsPage() {
    const [spools, setSpools] = useState<Spool[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number>(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [spoolToDelete, setSpoolToDelete] = useState<number | null>(null);

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

    const form = useForm({
        defaultValues: {
            vendor: "",
            material: "",
            materialType: "",
            color: "",
            colorRGB: "#000000",
            totalWeight: 0,
            usedWeight: 0,
            cost: 0,
            referenceLink: "",
            notes: "",
        },
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

    const handleAddNew = () => {
        setEditingId(0);
        form.reset();
        setEditDialogOpen(true);
    };

    const handleEdit = (spool: Spool) => {
        setEditingId(spool.id);
        form.setFieldValue("vendor", spool.vendor);
        form.setFieldValue("material", spool.material);
        form.setFieldValue("materialType", spool.materialType);
        form.setFieldValue("color", spool.color);
        form.setFieldValue("colorRGB", spool.colorRGB || "#000000");
        form.setFieldValue("totalWeight", spool.totalWeight);
        form.setFieldValue("usedWeight", spool.usedWeight);
        form.setFieldValue("cost", spool.cost);
        form.setFieldValue("referenceLink", spool.referenceLink);
        form.setFieldValue("notes", spool.notes);
        setEditDialogOpen(true);
    };

    if (loading) return <p className="p-6">Loading spools...</p>;

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Filament Spools</h1>
                <Button onClick={handleAddNew}>Add New Spool</Button>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Remaining (g)</TableHead>
                            <TableHead>Used (g)</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {spools.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={8}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No spools found. Add your first spool to get
                                    started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            spools.map((spool) => (
                                <TableRow key={spool.id}>
                                    <TableCell>{spool.vendor}</TableCell>
                                    <TableCell>{spool.material}</TableCell>
                                    <TableCell>{spool.materialType}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {spool.color}
                                            {spool.colorRGB && (
                                                <div
                                                    className="h-4 w-4 rounded border"
                                                    style={{
                                                        backgroundColor:
                                                            spool.colorRGB,
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{spool.totalWeight}</TableCell>
                                    <TableCell>{spool.usedWeight}</TableCell>
                                    <TableCell>${spool.cost}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleEdit(spool)
                                                }
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() =>
                                                    handleDeleteClick(spool.id)
                                                }
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
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
                        <FieldGroup>
                            <form.Field
                                name="vendor"
                                validators={{
                                    onChange: spoolSchema.shape.vendor,
                                }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="vendor">
                                            Vendor
                                        </FieldLabel>
                                        <Input
                                            id="vendor"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="e.g., Hatchbox, Prusa"
                                        />
                                        {field.state.meta.errors?.[0]
                                            ?.message && (
                                            <p className="text-sm text-red-600">
                                                {
                                                    field.state.meta.errors[0]
                                                        .message
                                                }
                                            </p>
                                        )}
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field
                                name="material"
                                validators={{
                                    onChange: spoolSchema.shape.material,
                                }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="material">
                                            Material
                                        </FieldLabel>
                                        <Input
                                            id="material"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="e.g., PLA, PETG, ABS"
                                        />
                                        {field.state.meta.errors?.[0]
                                            ?.message && (
                                            <p className="text-sm text-red-600">
                                                {
                                                    field.state.meta.errors[0]
                                                        .message
                                                }
                                            </p>
                                        )}
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field
                                name="materialType"
                                validators={{
                                    onChange: spoolSchema.shape.materialType,
                                }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="materialType">
                                            Material Type
                                        </FieldLabel>
                                        <Input
                                            id="materialType"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="e.g., Standard, Pro, Silk"
                                        />
                                        {field.state.meta.errors?.[0]
                                            ?.message && (
                                            <p className="text-sm text-red-600">
                                                {
                                                    field.state.meta.errors[0]
                                                        .message
                                                }
                                            </p>
                                        )}
                                    </Field>
                                )}
                            </form.Field>

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field
                                    name="color"
                                    validators={{
                                        onChange: spoolSchema.shape.color,
                                    }}
                                >
                                    {(field) => (
                                        <Field>
                                            <FieldLabel htmlFor="color">
                                                Color
                                            </FieldLabel>
                                            <Input
                                                id="color"
                                                value={field.state.value}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                placeholder="e.g., Red, Blue"
                                            />
                                            {field.state.meta.errors?.[0]
                                                ?.message && (
                                                <p className="text-sm text-red-600">
                                                    {
                                                        field.state.meta
                                                            .errors[0].message
                                                    }
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="colorRGB"
                                    validators={{
                                        onChange: spoolSchema.shape.colorRGB,
                                    }}
                                >
                                    {(field) => (
                                        <Field>
                                            <FieldLabel htmlFor="colorRGB">
                                                Color Picker
                                            </FieldLabel>
                                            <Input
                                                id="colorRGB"
                                                type="color"
                                                value={field.state.value}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                className="h-10 hover:cursor-pointer"
                                            />
                                            {field.state.meta.errors?.[0]
                                                ?.message && (
                                                <p className="text-sm text-red-600">
                                                    {
                                                        field.state.meta
                                                            .errors[0].message
                                                    }
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field
                                    name="totalWeight"
                                    validators={{
                                        onChange: spoolSchema.shape.totalWeight,
                                    }}
                                >
                                    {(field) => (
                                        <Field>
                                            <FieldLabel htmlFor="totalWeight">
                                                Remaining Weight
                                            </FieldLabel>
                                            <InputGroup>
                                                <InputGroupAddon align="inline-end">
                                                    <InputGroupText>
                                                        grams
                                                    </InputGroupText>
                                                </InputGroupAddon>
                                                <InputGroupInput
                                                    id="totalWeight"
                                                    type="number"
                                                    value={field.state.value}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            parseInt(
                                                                e.target.value
                                                            ) || 0
                                                        )
                                                    }
                                                    onBlur={field.handleBlur}
                                                    placeholder="1000"
                                                />
                                            </InputGroup>
                                            {field.state.meta.errors?.[0]
                                                ?.message && (
                                                <p className="text-sm text-red-600">
                                                    {
                                                        field.state.meta
                                                            .errors[0].message
                                                    }
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                </form.Field>

                                <form.Field
                                    name="usedWeight"
                                    validators={{
                                        onChange: spoolSchema.shape.usedWeight,
                                    }}
                                >
                                    {(field) => (
                                        <Field>
                                            <FieldLabel htmlFor="usedWeight">
                                                Used Weight
                                            </FieldLabel>
                                            <InputGroup>
                                                <InputGroupAddon align="inline-end">
                                                    <InputGroupText>
                                                        grams
                                                    </InputGroupText>
                                                </InputGroupAddon>
                                                <InputGroupInput
                                                    id="usedWeight"
                                                    type="number"
                                                    value={field.state.value}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            parseInt(
                                                                e.target.value
                                                            ) || 0
                                                        )
                                                    }
                                                    onBlur={field.handleBlur}
                                                    placeholder="0"
                                                />
                                            </InputGroup>
                                            {field.state.meta.errors?.[0]
                                                ?.message && (
                                                <p className="text-sm text-red-600">
                                                    {
                                                        field.state.meta
                                                            .errors[0].message
                                                    }
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                </form.Field>
                            </div>

                            <form.Field
                                name="cost"
                                validators={{
                                    onChange: spoolSchema.shape.cost,
                                }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="cost">
                                            Cost
                                        </FieldLabel>
                                        <InputGroup>
                                            <InputGroupAddon>
                                                <InputGroupText>
                                                    AED
                                                </InputGroupText>
                                            </InputGroupAddon>
                                            <InputGroupInput
                                                id="cost"
                                                type="number"
                                                value={field.state.value}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        parseFloat(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                placeholder="20"
                                            />
                                        </InputGroup>
                                        {field.state.meta.errors?.[0]
                                            ?.message && (
                                            <p className="text-sm text-red-600">
                                                {
                                                    field.state.meta.errors[0]
                                                        .message
                                                }
                                            </p>
                                        )}
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field
                                name="referenceLink"
                                validators={{
                                    onChange: spoolSchema.shape.referenceLink,
                                }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="referenceLink">
                                            Reference Link
                                        </FieldLabel>
                                        <Input
                                            id="referenceLink"
                                            type="url"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="https://..."
                                        />
                                        {field.state.meta.errors && (
                                            <p className="text-sm text-red-600">
                                                {field.state.meta.errors.join(
                                                    ", "
                                                )}
                                            </p>
                                        )}
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field
                                name="notes"
                                validators={{
                                    onChange: spoolSchema.shape.notes,
                                }}
                            >
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="notes">
                                            Notes
                                        </FieldLabel>
                                        <Textarea
                                            id="notes"
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="Add any additional notes..."
                                            rows={3}
                                        />
                                        {field.state.meta.errors?.[0]
                                            ?.message && (
                                            <p className="text-sm text-red-600">
                                                {
                                                    field.state.meta.errors[0]
                                                        .message
                                                }
                                            </p>
                                        )}
                                    </Field>
                                )}
                            </form.Field>
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
                            delete the spool from your inventory.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
