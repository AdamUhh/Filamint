import { useKeyCombos } from "@/hooks/useKeyCombo";
import { MenuIcon, PlusIcon, StarIcon } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";

import { AppPagination } from "@/components/Pagination";
import { AppSearch } from "@/components/Search";
import {
    DeleteSpoolDialog,
    type DeleteState,
} from "@/components/Spools/DeleteDialog";
import { SpoolForm } from "@/components/Spools/Form";
import { SpoolTable } from "@/components/Spools/SpoolTable";
import {
    PAGE_SIZE,
    defaultSpoolValues,
} from "@/components/Spools/lib/defaults";
import {
    useCreateSpool,
    useDeleteSpool,
    useSpoolEvents,
    useSpools,
    useUpdateSpool,
} from "@/components/Spools/lib/fetch-hooks";
import { useAppForm } from "@/components/Spools/lib/hooks";
import { spoolSchema } from "@/components/Spools/lib/schema";

import type { Spool, SpoolQueryParams } from "@bindings";

type EditState = {
    isOpen: boolean;
    id: number;
    original: Spool | null;
};

export function SpoolsPage() {
    const [templateOpen, setTemplateOpen] = useState(false);

    const [queryParams, setQueryParams] = useState<SpoolQueryParams>({
        search: "",
        isTemplate: templateOpen,
        sortBy: "updated_at",
        sortOrder: "desc",
        limit: PAGE_SIZE,
        offset: 0,
    });

    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });

    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);

    const { spools, total, isFetching } = useSpools({
        ...queryParams,
        isTemplate: templateOpen ? true : false,
    });

    const deleteMutation = useDeleteSpool();

    const handleSearch = (searchTerm: string) => {
        setQueryParams((prev) => ({
            ...prev,
            search: searchTerm,
            offset: 0,
        }));
    };

    const handleSort = (column: string) => {
        setQueryParams((prev) => ({
            ...prev,
            sortBy: column,
            sortOrder:
                prev.sortBy === column && prev.sortOrder === "desc"
                    ? "asc"
                    : "desc",
        }));
    };

    const handlePageChange = (page: number) => {
        setQueryParams((prev) => ({
            ...prev,
            offset: (page - 1) * PAGE_SIZE,
        }));
    };

    const currentPage =
        Math.floor(
            (queryParams.offset || 0) / (queryParams.limit || PAGE_SIZE)
        ) + 1;

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const handleViewTemplate = () => {
        setTemplateOpen((prev) => !prev);
    };

    const handleCreate = () => {
        setEditState({ isOpen: true, id: 0, original: null });
    };

    useSpoolEvents(handleCreate, handleViewTemplate);

    const handleDeleteConfirm = async () => {
        if (!deleteIntent) return;
        try {
            await deleteMutation.mutateAsync(deleteIntent.spoolId);
        } catch (error) {
            console.error("Failed to delete print:", error);
            // TODO: Show error toast
        } finally {
            setDeleteIntent(null);
        }
    };

    return (
        <div className="space-y-6 p-6">
            <SpoolHeader
                templateOpen={templateOpen}
                onViewTemplate={handleViewTemplate}
                onCreate={handleCreate}
            />
            <div className="flex items-center justify-between">
                <div className="flex w-full gap-2">
                    <AppSearch
                        onSearch={handleSearch}
                        qualifierKeys={["vendor", "spool", "material", "color"]}
                    />
                    <div className="mt-2 text-xs text-muted-foreground">
                        {isFetching
                            ? "Loading spools..."
                            : `Showing ${spools.size} of ${total} spools${
                                  queryParams.search
                                      ? ` matching "${queryParams.search}"`
                                      : ""
                              }`}
                    </div>
                </div>

                <AppPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            </div>

            <SpoolTable
                isLoading={isFetching}
                spools={spools}
                templateOpen={templateOpen}
                onDelete={(id) => setDeleteIntent({ spoolId: id })}
                onEdit={(spool) =>
                    setEditState({
                        id: spool.id,
                        isOpen: true,
                        original: spool,
                    })
                }
                onDuplicate={(spool) =>
                    setEditState({
                        id: 0,
                        isOpen: true,
                        original: spool,
                    })
                }
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder as "asc" | "desc"}
                onSort={handleSort}
            />

            <SpoolFormDialog
                editState={editState}
                setEditState={setEditState}
            />

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

function SpoolFormDialog({
    editState,
    setEditState,
}: {
    editState: EditState;
    setEditState: Dispatch<SetStateAction<EditState>>;
}) {
    const createMutation = useCreateSpool();
    const updateMutation = useUpdateSpool();

    const form = useAppForm({
        defaultValues: defaultSpoolValues,
        validators: { onChange: spoolSchema },
        onSubmit: async ({ value }) => {
            const spoolToSave: Spool = {
                id: editState.id,
                spoolCode: String(editState.id),
                ...value,
                firstUsedAt: null, // placeholder, ignored by db
                lastUsedAt: null, // placeholder, ignored by db
                createdAt: null, // placeholder, ignored by db
                updatedAt: null, // placeholder, ignored by db
            };

            if (editState.id > 0) {
                await updateMutation.mutateAsync(spoolToSave);
            } else {
                await createMutation.mutateAsync(spoolToSave);
            }

            form.reset();
            setEditState({ id: 0, isOpen: false, original: null });
        },
    });

    useEffect(() => {
        if (editState.isOpen && editState.original) {
            form.setFieldValue("vendor", editState.original.vendor, {
                dontValidate: true,
            });
            form.setFieldValue("usedWeight", editState.original.usedWeight, {
                dontValidate: true,
            });
            form.setFieldValue("cost", editState.original.cost, {
                dontValidate: true,
            });
            form.setFieldValue(
                "referenceLink",
                editState.original.referenceLink,
                { dontValidate: true }
            );
            form.setFieldValue("notes", editState.original.notes, {
                dontValidate: true,
            });
            form.setFieldValue("totalWeight", editState.original.totalWeight, {
                dontValidate: true,
            });
            form.setFieldValue("color", editState.original.color, {
                dontValidate: true,
            });
            form.setFieldValue("colorHex", editState.original.colorHex, {
                dontValidate: true,
            });
            form.setFieldValue("material", editState.original.material, {
                dontValidate: true,
            });
            form.setFieldValue(
                "materialType",
                editState.original.materialType,
                { dontValidate: true }
            );
            form.setFieldValue("isTemplate", editState.original.isTemplate, {
                dontValidate: true,
            });
        }
    }, [editState, form]);

    const handleClose = () => {
        form.reset();
        setEditState({ id: 0, isOpen: false, original: null });
    };

    return (
        <Dialog
            open={editState.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) handleClose();
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
                        form.handleSubmit();
                    }}
                >
                    <SpoolForm form={form} editState={editState} />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
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
                            {editState.id > 0 ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
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
                <LazyTooltip content={templateCombo}>
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
                </LazyTooltip>

                <LazyTooltip content={createCombo}>
                    <Button onClick={onCreate}>
                        <PlusIcon /> Add Spool
                    </Button>
                </LazyTooltip>
            </ButtonGroup>
        </div>
    );
}
