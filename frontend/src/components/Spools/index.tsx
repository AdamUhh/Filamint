import { useKeyCombos } from "@/hooks/useKeyCombo";
import {
    type SpoolQueryParams,
    useCreateSpool,
    useDeleteSpool,
    useSpools,
    useUpdateSpool,
} from "@/hooks/useSpools";
import { Events } from "@wailsio/runtime";
import { format } from "date-fns";
import { MenuIcon, PlusIcon, RotateCwIcon, StarIcon } from "lucide-react";
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

import { SpoolPagination } from "@/components/Pagination";
import { SpoolSearch } from "@/components/Search";
import {
    DeleteSpoolDialog,
    type DeleteState,
} from "@/components/Spools/deleteDialog";
import { type EditState, SpoolForm } from "@/components/Spools/form";
import { defaultSpoolValues } from "@/components/Spools/lib/defaults";
import { useAppForm } from "@/components/Spools/lib/hooks";
import { spoolSchema } from "@/components/Spools/lib/schema";
import { SpoolTable } from "@/components/Spools/spoolTable";

import { Spool } from "@bindings";

const PAGE_SIZE = 20;

export function SpoolsPage() {
    const [queryParams, setQueryParams] = useState<SpoolQueryParams>({
        search: "",
        sortBy: "updated_at",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
    });

    const [templateOpen, setTemplateOpen] = useState(false);

    const { spools, total, isFetching } = useSpools({
        ...queryParams,
        isTemplate: templateOpen ? true : undefined,
    });
    const createMutation = useCreateSpool();
    const updateMutation = useUpdateSpool();
    const deleteMutation = useDeleteSpool();

    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });
    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);

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
                    await updateMutation.mutateAsync(spoolToSave);
                } else {
                    await createMutation.mutateAsync(spoolToSave);
                }
                setEditState({ id: 0, isOpen: false, original: null });
                form.reset();
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
            await deleteMutation.mutateAsync(deleteIntent.spoolId);
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

    const handleSearch = useCallback((searchTerm: string) => {
        setQueryParams((prev) => ({
            ...prev,
            search: searchTerm,
            offset: 0, // Reset to first page on search
        }));
    }, []);

    const handleSort = useCallback((column: string) => {
        setQueryParams((prev) => ({
            ...prev,
            sortBy: column,
            sortOrder:
                prev.sortBy === column && prev.sortOrder === "desc"
                    ? "asc"
                    : "desc",
        }));
    }, []);

    const handlePageChange = useCallback((page: number) => {
        setQueryParams((prev) => ({
            ...prev,
            offset: (page - 1) * PAGE_SIZE,
        }));
    }, []);

    const currentPage =
        Math.floor(
            (queryParams.offset || 0) / (queryParams.limit || PAGE_SIZE)
        ) + 1;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    console.debug("errors! : ", form.state.isValid, form.state.errors);

    return (
        <div className="space-y-6 p-6">
            <SpoolHeader
                onCreate={handleCreate}
                templateOpen={templateOpen}
                onViewTemplate={handleViewTemplate}
            />

            <div className="flex items-center gap-2">
                <SpoolSearch onSearch={handleSearch} />

                {isFetching ? (
                    <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                        <RotateCwIcon className="size-3 animate-spin" />
                        <span>Loading spools...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <p>
                            Showing {spools.size} of {total} spools
                            {queryParams.search &&
                                ` matching "${queryParams.search}"`}
                        </p>
                    </div>
                )}
            </div>

            <SpoolTable
                isLoading={isFetching}
                spools={spools}
                templateOpen={templateOpen}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder}
                onSort={handleSort}
            />

            <SpoolPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

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
                                <Button
                                    type="submit"
                                    disabled={
                                        createMutation.isPending ||
                                        updateMutation.isPending
                                    }
                                >
                                    {createMutation.isPending ||
                                    updateMutation.isPending
                                        ? "Saving..."
                                        : editState.id > 0
                                          ? "Update"
                                          : "Create"}
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
