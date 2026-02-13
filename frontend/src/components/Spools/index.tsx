import { useApp } from "@/context/useContext";
import { useKeyCombos } from "@/hooks/useKeyCombo";
import { Events } from "@wailsio/runtime";
import { format } from "date-fns";
import { MenuIcon, PlusIcon, StarIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/tooltip";

import {
    DeleteSpoolDialog,
    type DeleteState,
} from "@/components/Spools/deleteDialog";
import { type EditState, SpoolForm } from "@/components/Spools/form";
import { defaultSpoolValues } from "@/components/Spools/lib/defaults";
import { useAppForm } from "@/components/Spools/lib/hooks";
import { spoolSchema } from "@/components/Spools/lib/schema";
import { SpoolTable } from "@/components/Spools/spoolTable";

import { Spool, SpoolService } from "@bindings";

export function SpoolsPage() {
    const { spools, isLoading, refreshSpools } = useApp();

    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });
    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);
    const [templateOpen, setTemplateOpen] = useState(false);

    const form = useAppForm({
        defaultValues: defaultSpoolValues,
        validators: { onChange: spoolSchema },
        onSubmit: async ({ value }) => {
            const now = new Date().toISOString();
            const spoolToSave: Spool = {
                id: editState.id,
                spoolCode: String(editState.id), // auto generated backend
                ...value,
                firstUsedAt: null,
                lastUsedAt: null,
                createdAt:
                    editState.id > 0
                        ? spools.get(editState.id)?.createdAt || now
                        : now,
                updatedAt: now,
            };

            try {
                if (editState.id > 0) {
                    await SpoolService.UpdateSpool(spoolToSave);
                } else {
                    await SpoolService.CreateSpool(spoolToSave);
                }
                setEditState({ id: 0, isOpen: false, original: null });
                form.reset();
                refreshSpools();
            } catch (err) {
                console.error("Failed to save spool:", err);
            }
        },
    });

    const handleViewTemplate = useCallback(() => {
        setTemplateOpen((prev) => !prev);
    }, []);

    const handleCreate = useCallback(() => {
        setEditState({ isOpen: true, id: 0, original: null });
        form.reset();
    }, [form]);

    const populateFormFromPrint = useCallback(
        (spool: Spool, isDuplicate = false) => {
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
            form.setFieldValue(
                "isTemplate",
                isDuplicate ? false : spool.isTemplate
            );
        },
        [form]
    );

    const handleEdit = useCallback(
        (spool: Spool) => {
            setEditState({ isOpen: true, id: spool.id, original: spool });
            populateFormFromPrint(spool);
        },
        [populateFormFromPrint]
    );

    const handleDuplicate = useCallback(
        (spool: Spool) => {
            setEditState({ isOpen: true, id: 0, original: spool });
            populateFormFromPrint(spool, true);
        },
        [populateFormFromPrint]
    );

    useEffect(() => {
        const unsubSpoolCreate = Events.On("spool:create", handleCreate);
        const unsubToggleTemplate = Events.On(
            "spool:toggle_template",
            handleViewTemplate
        );

        return () => {
            unsubSpoolCreate();
            unsubToggleTemplate();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = (spoolId: number) => {
        setDeleteIntent({ spoolId });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteIntent) return;

        try {
            await SpoolService.DeleteSpool(deleteIntent.spoolId);
            refreshSpools();
        } catch (error) {
            console.error("Failed to delete spool:", error);
            // TODO: Show error toast
        } finally {
            setDeleteIntent(null);
        }
    };

    const handleCloseDialog = useCallback(() => {
        form.reset();
        setEditState({ id: 0, isOpen: false, original: null });
    }, [form]);

    if (isLoading) return <p className="p-6">Loading spools...</p>;

    console.debug("errors! : ", form.state.isValid, form.state.errors);

    return (
        <div className="space-y-6 p-6">
            <SpoolHeader
                onCreate={handleCreate}
                templateOpen={templateOpen}
                onViewTemplate={handleViewTemplate}
            />
            <SpoolTable
                spools={spools}
                templateOpen={templateOpen}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
            />

            {/* Edit/Create Dialog */}
            <Dialog
                open={editState.isOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) handleCloseDialog();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editState.id > 0 ? "Edit Spool" : "Add New Spool"}
                        </DialogTitle>
                    </DialogHeader>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                    >
                        <SpoolForm form={form} editState={editState} />
                        <DialogFooter className="relative">
                            <div className="absolute top-1/2 left-4 -translate-y-1/2">
                                {editState.id > 0 &&
                                    `Created On: ${format(editState.original?.createdAt, "PPp")}`}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCloseDialog}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {editState.id > 0 ? "Update" : "Create"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {deleteIntent && (
                <DeleteSpoolDialog
                    intent={deleteIntent}
                    onIntentChange={setDeleteIntent}
                    onConfirm={handleDeleteConfirm}
                />
            )}
        </div>
    );
}

function SpoolHeader({
    templateOpen,
    onViewTemplate,
    onCreate,
}: {
    templateOpen: boolean;
    onViewTemplate: () => void;
    onCreate: () => void;
}) {
    const [createCombo, templateCombo] = useKeyCombos([
        "spool:create",
        "spool:toggle_template",
    ]);

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <h1 className="text-3xl font-bold">
                    Filament Spools {templateOpen && "- Templates"}
                </h1>
                <p className="text-muted-foreground">
                    This is where your spools live.
                </p>
            </div>
            <ButtonGroup>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" onClick={onViewTemplate}>
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
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{templateCombo}</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={onCreate}>
                            <PlusIcon /> Add Spool
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{createCombo}</p>
                    </TooltipContent>
                </Tooltip>
            </ButtonGroup>
        </div>
    );
}
