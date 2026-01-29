import { useForm } from "@tanstack/react-form";
import { PlusIcon, StarIcon } from "lucide-react";
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
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
    InputGroupTextarea,
} from "@/components/ui/input-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { Spool, SpoolService } from "@bindings";

import { Checkbox } from "./ui/checkbox";
import { ColorPicker } from "./ui/custom/color-picker";

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

export default function SpoolsPage() {
    const [spools, setSpools] = useState<Spool[]>([]);
    const [loading, setLoading] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
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

    const form = useForm({
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
        setTemplateDialogOpen(true);
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
                <h1 className="text-3xl font-bold">Filament Spools</h1>
                <ButtonGroup>
                    <Button variant="outline" onClick={handleViewTemplate}>
                        <StarIcon /> View Templates
                    </Button>
                    <Button onClick={handleAddNew}>
                        <PlusIcon /> Add Spool
                    </Button>
                </ButtonGroup>
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
                            spools
                                .filter((spool) => !spool.isTemplate)
                                .map((spool) => (
                                    <TableRow key={spool.id}>
                                        <TableCell>{spool.vendor}</TableCell>
                                        <TableCell>{spool.material}</TableCell>
                                        <TableCell>
                                            {spool.materialType}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {spool.colorHex && (
                                                    <div
                                                        className="-mt-0.5 h-4 w-4 rounded"
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
                                            {spool.totalWeight}
                                        </TableCell>
                                        <TableCell>
                                            {spool.usedWeight}
                                        </TableCell>
                                        <TableCell>AED {spool.cost}</TableCell>
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
                                                        handleDeleteClick(
                                                            spool.id
                                                        )
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

            <Dialog
                open={templateDialogOpen}
                onOpenChange={setTemplateDialogOpen}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>View Templates</DialogTitle>
                    </DialogHeader>
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
                                        No templates found. Add your first
                                        template spool to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                spools
                                    .filter((spool) => spool.isTemplate)
                                    .map((spool) => (
                                        <TableRow key={spool.id}>
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
                                                            className="-mt-0.5 h-4 w-4 rounded"
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
                                                {spool.totalWeight}
                                            </TableCell>
                                            <TableCell>
                                                {spool.usedWeight}
                                            </TableCell>
                                            <TableCell>
                                                AED {spool.cost}
                                            </TableCell>
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
                                                            handleDeleteClick(
                                                                spool.id
                                                            )
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
                </DialogContent>
            </Dialog>

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
                            <form.Field
                                name="vendor"
                                children={(field) => {
                                    const isInvalid =
                                        field.state.meta.isTouched &&
                                        !field.state.meta.isValid;
                                    return (
                                        <Field
                                            data-invalid={isInvalid}
                                            className="group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    Vendor
                                                </FieldLabel>
                                                {editingId > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                        onClick={() =>
                                                            resetToOriginal(
                                                                field.name
                                                            )
                                                        }
                                                    >
                                                        Reset
                                                    </Button>
                                                )}
                                            </div>
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value
                                                    )
                                                }
                                                aria-invalid={isInvalid}
                                                placeholder="e.g., CC3D, Elegoo"
                                                autoComplete="off"
                                            />
                                            {isInvalid && (
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            )}
                                        </Field>
                                    );
                                }}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field
                                    name="material"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched &&
                                            !field.state.meta.isValid;
                                        return (
                                            <Field
                                                data-invalid={isInvalid}
                                                className="group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel
                                                        htmlFor={field.name}
                                                    >
                                                        Material
                                                    </FieldLabel>
                                                    {editingId > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                            onClick={() =>
                                                                resetToOriginal(
                                                                    field.name
                                                                )
                                                            }
                                                        >
                                                            Reset
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value
                                                        )
                                                    }
                                                    aria-invalid={isInvalid}
                                                    placeholder="e.g., PLA, PETG, ABS"
                                                    autoComplete="off"
                                                />
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        );
                                    }}
                                />

                                <form.Field
                                    name="materialType"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched &&
                                            !field.state.meta.isValid;
                                        return (
                                            <Field
                                                data-invalid={isInvalid}
                                                className="group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel
                                                        htmlFor={field.name}
                                                    >
                                                        Material Type
                                                    </FieldLabel>
                                                    {editingId > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                            onClick={() =>
                                                                resetToOriginal(
                                                                    field.name
                                                                )
                                                            }
                                                        >
                                                            Reset
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value
                                                        )
                                                    }
                                                    aria-invalid={isInvalid}
                                                    placeholder="e.g., Basic, Pro, Silk"
                                                    autoComplete="off"
                                                />
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        );
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field
                                    name="color"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched &&
                                            !field.state.meta.isValid;
                                        return (
                                            <Field
                                                data-invalid={isInvalid}
                                                className="group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel
                                                        htmlFor={field.name}
                                                    >
                                                        Color
                                                    </FieldLabel>
                                                    {editingId > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                            onClick={() =>
                                                                resetToOriginal(
                                                                    field.name
                                                                )
                                                            }
                                                        >
                                                            Reset
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    id={field.name}
                                                    name={field.name}
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value
                                                        )
                                                    }
                                                    aria-invalid={isInvalid}
                                                    placeholder="e.g., Black, Blue"
                                                    autoComplete="off"
                                                />
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        );
                                    }}
                                />

                                <form.Field
                                    name="colorHex"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched &&
                                            !field.state.meta.isValid;
                                        return (
                                            <Field
                                                data-invalid={isInvalid}
                                                className="group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <FieldLabel
                                                        htmlFor={field.name}
                                                    >
                                                        Color Hex
                                                    </FieldLabel>
                                                    {editingId > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                            onClick={() =>
                                                                resetToOriginal(
                                                                    field.name
                                                                )
                                                            }
                                                        >
                                                            Reset
                                                        </Button>
                                                    )}
                                                </div>
                                                <ColorPicker
                                                    name={field.name}
                                                    error={isInvalid}
                                                    value={field.state.value}
                                                    onChange={(color) =>
                                                        field.handleChange(
                                                            color
                                                        )
                                                    }
                                                    onBlur={field.handleBlur}
                                                />
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        );
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <form.Field
                                    name="totalWeight"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched &&
                                            !field.state.meta.isValid;
                                        return (
                                            <Field
                                                data-invalid={isInvalid}
                                                className="group"
                                            >
                                                <div className="flex h-6 items-center justify-between">
                                                    <FieldLabel
                                                        htmlFor={field.name}
                                                    >
                                                        Remaining Weight
                                                    </FieldLabel>
                                                    <div className="hidden items-center gap-1 group-hover:flex">
                                                        {editingId > 0 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-auto px-2 py-0 text-xs"
                                                                onClick={() =>
                                                                    resetToOriginal(
                                                                        field.name
                                                                    )
                                                                }
                                                            >
                                                                Reset
                                                            </Button>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() =>
                                                                field.handleChange(
                                                                    Math.max(
                                                                        0,
                                                                        field
                                                                            .state
                                                                            .value -
                                                                            1
                                                                    )
                                                                )
                                                            }
                                                        >
                                                            -
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() =>
                                                                field.handleChange(
                                                                    field.state
                                                                        .value +
                                                                        1
                                                                )
                                                            }
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                </div>
                                                <InputGroup>
                                                    <InputGroupAddon align="inline-end">
                                                        <InputGroupText>
                                                            grams
                                                        </InputGroupText>
                                                    </InputGroupAddon>
                                                    <InputGroupInput
                                                        id={field.name}
                                                        name={field.name}
                                                        type="number"
                                                        value={Number(
                                                            field.state.value
                                                        ).toString()}
                                                        onBlur={
                                                            field.handleBlur
                                                        }
                                                        onChange={(e) =>
                                                            field.handleChange(
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                ) || 0
                                                            )
                                                        }
                                                        aria-invalid={isInvalid}
                                                        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    />
                                                </InputGroup>
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        );
                                    }}
                                />

                                <form.Field
                                    name="usedWeight"
                                    children={(field) => {
                                        const isInvalid =
                                            field.state.meta.isTouched &&
                                            !field.state.meta.isValid;
                                        return (
                                            <Field
                                                data-invalid={isInvalid}
                                                className="group"
                                            >
                                                <div className="flex h-6 items-center justify-between">
                                                    <FieldLabel
                                                        htmlFor={field.name}
                                                    >
                                                        Used Weight
                                                    </FieldLabel>
                                                    <div className="hidden items-center gap-1 group-hover:flex">
                                                        {editingId > 0 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-auto px-2 py-0 text-xs"
                                                                onClick={() =>
                                                                    resetToOriginal(
                                                                        field.name
                                                                    )
                                                                }
                                                            >
                                                                Reset
                                                            </Button>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() =>
                                                                field.handleChange(
                                                                    Math.max(
                                                                        0,
                                                                        field
                                                                            .state
                                                                            .value -
                                                                            1
                                                                    )
                                                                )
                                                            }
                                                        >
                                                            -
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() =>
                                                                field.handleChange(
                                                                    field.state
                                                                        .value +
                                                                        1
                                                                )
                                                            }
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                </div>
                                                <InputGroup>
                                                    <InputGroupAddon align="inline-end">
                                                        <InputGroupText>
                                                            grams
                                                        </InputGroupText>
                                                    </InputGroupAddon>
                                                    <InputGroupInput
                                                        id={field.name}
                                                        name={field.name}
                                                        type="number"
                                                        value={Number(
                                                            field.state.value
                                                        ).toString()}
                                                        onBlur={
                                                            field.handleBlur
                                                        }
                                                        onChange={(e) =>
                                                            field.handleChange(
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                ) || 0
                                                            )
                                                        }
                                                        aria-invalid={isInvalid}
                                                        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    />
                                                </InputGroup>
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        );
                                    }}
                                />
                            </div>

                            <form.Field
                                name="cost"
                                children={(field) => {
                                    const isInvalid =
                                        field.state.meta.isTouched &&
                                        !field.state.meta.isValid;
                                    return (
                                        <Field
                                            data-invalid={isInvalid}
                                            className="group"
                                        >
                                            <div className="flex h-6 items-center justify-between">
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    Cost
                                                </FieldLabel>
                                                <div className="hidden items-center gap-1 group-hover:flex">
                                                    {editingId > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                            onClick={() =>
                                                                resetToOriginal(
                                                                    field.name
                                                                )
                                                            }
                                                        >
                                                            Reset
                                                        </Button>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() =>
                                                            field.handleChange(
                                                                Math.max(
                                                                    0,
                                                                    field.state
                                                                        .value -
                                                                        1
                                                                )
                                                            )
                                                        }
                                                    >
                                                        -
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() =>
                                                            field.handleChange(
                                                                field.state
                                                                    .value + 1
                                                            )
                                                        }
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>
                                            <InputGroup>
                                                <InputGroupAddon>
                                                    <InputGroupText>
                                                        AED
                                                    </InputGroupText>
                                                </InputGroupAddon>
                                                <InputGroupInput
                                                    id={field.name}
                                                    name={field.name}
                                                    type="number"
                                                    value={Number(
                                                        field.state.value
                                                    ).toString()}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            parseFloat(
                                                                e.target.value
                                                            ) || 0
                                                        )
                                                    }
                                                    aria-invalid={isInvalid}
                                                    step="0.01"
                                                    className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                />
                                            </InputGroup>
                                            {isInvalid && (
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            )}
                                        </Field>
                                    );
                                }}
                            />

                            <form.Field
                                name="referenceLink"
                                children={(field) => {
                                    const isInvalid =
                                        field.state.meta.isTouched &&
                                        !field.state.meta.isValid;
                                    return (
                                        <Field
                                            data-invalid={isInvalid}
                                            className="group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    Reference Link
                                                </FieldLabel>
                                                {editingId > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                        onClick={() =>
                                                            resetToOriginal(
                                                                field.name
                                                            )
                                                        }
                                                    >
                                                        Reset
                                                    </Button>
                                                )}
                                            </div>
                                            <Input
                                                id={field.name}
                                                name={field.name}
                                                type="url"
                                                value={field.state.value}
                                                onBlur={field.handleBlur}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value
                                                    )
                                                }
                                                aria-invalid={isInvalid}
                                                placeholder="https://..."
                                                autoComplete="off"
                                            />
                                            {isInvalid && (
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            )}
                                        </Field>
                                    );
                                }}
                            />

                            <form.Field
                                name="notes"
                                children={(field) => {
                                    const isInvalid =
                                        field.state.meta.isTouched &&
                                        !field.state.meta.isValid;
                                    return (
                                        <Field
                                            data-invalid={isInvalid}
                                            className="group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <FieldLabel
                                                    htmlFor={field.name}
                                                >
                                                    Notes
                                                </FieldLabel>
                                                {editingId > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="hidden h-auto px-2 py-0 text-xs group-hover:block"
                                                        onClick={() =>
                                                            resetToOriginal(
                                                                field.name
                                                            )
                                                        }
                                                    >
                                                        Reset
                                                    </Button>
                                                )}
                                            </div>
                                            <InputGroup>
                                                <InputGroupTextarea
                                                    id={field.name}
                                                    name={field.name}
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) =>
                                                        field.handleChange(
                                                            e.target.value
                                                        )
                                                    }
                                                    aria-invalid={isInvalid}
                                                    placeholder="Add any additional notes..."
                                                    rows={3}
                                                />
                                                <InputGroupAddon align="block-end">
                                                    <InputGroupText className="ml-auto">
                                                        {
                                                            field.state.value
                                                                .length
                                                        }
                                                        /2000
                                                    </InputGroupText>
                                                </InputGroupAddon>
                                                {isInvalid && (
                                                    <FieldError
                                                        errors={
                                                            field.state.meta
                                                                .errors
                                                        }
                                                    />
                                                )}
                                            </InputGroup>
                                        </Field>
                                    );
                                }}
                            />

                            <form.Field
                                name="isTemplate"
                                children={(field) => {
                                    const isInvalid =
                                        field.state.meta.isTouched &&
                                        !field.state.meta.isValid;

                                    return (
                                        <Field
                                            data-invalid={isInvalid}
                                            orientation="horizontal"
                                        >
                                            <Checkbox
                                                id="isTemplate"
                                                name="isTemplate"
                                                checked={
                                                    field.state.value === true
                                                }
                                                onCheckedChange={(e) =>
                                                    field.handleChange(
                                                        e === true
                                                    )
                                                }
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor="isTemplate">
                                                    Use as template?
                                                </FieldLabel>
                                                <FieldDescription>
                                                    Reuse this spool when buying
                                                    the same filament again.
                                                </FieldDescription>
                                            </FieldContent>
                                            {isInvalid && (
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            )}
                                        </Field>
                                    );
                                }}
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
