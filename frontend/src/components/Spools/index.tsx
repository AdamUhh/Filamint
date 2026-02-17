import { useKeyCombos } from "@/hooks/useKeyCombo";
import {
    type SpoolQueryParams,
    useCreateSpool,
    useDeleteSpool,
    useSpoolEvents,
    useSpools,
    useUpdateSpool,
} from "@/hooks/useSpools";
import { MenuIcon, PlusIcon, StarIcon } from "lucide-react";
import { useCallback, useState } from "react";

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

const PAGE_SIZE = 15;

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

    const handleSearch = useCallback((searchTerm: string) => {
        setQueryParams((prev) => ({
            ...prev,
            search: searchTerm,
            offset: 0,
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

    return (
        <div className="space-y-6 p-6">
            <SpoolHeaderContainer
                templateOpen={templateOpen}
                setTemplateOpen={setTemplateOpen}
            />

            <SpoolListSection
                spools={spools}
                total={total}
                isFetching={isFetching}
                templateOpen={templateOpen}
                search={queryParams.search}
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder}
                onSearch={handleSearch}
                onSort={handleSort}
                onPageChange={handlePageChange}
                currentPage={currentPage}
                totalPages={totalPages}
            />
        </div>
    );
}

function SpoolHeaderContainer({
    templateOpen,
    setTemplateOpen,
}: {
    templateOpen: boolean;
    setTemplateOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });

    const handleCreate = useCallback(() => {
        setEditState({ isOpen: true, id: 0, original: null });
    }, []);

    const handleViewTemplate = useCallback(() => {
        setTemplateOpen((prev) => !prev);
    }, [setTemplateOpen]);

    useSpoolEvents(handleCreate, handleViewTemplate);

    return (
        <>
            <SpoolHeader
                onCreate={handleCreate}
                templateOpen={templateOpen}
                onViewTemplate={handleViewTemplate}
            />

            <SpoolFormDialog
                editState={editState}
                setEditState={setEditState}
            />
        </>
    );
}

function SpoolFormDialog({
    editState,
    setEditState,
}: {
    editState: EditState;
    setEditState: React.Dispatch<React.SetStateAction<EditState>>;
}) {
    const createMutation = useCreateSpool();
    const updateMutation = useUpdateSpool();
    const { spools } = useSpools({ limit: 1 }); // lightweight access

    const form = useAppForm({
        defaultValues: defaultSpoolValues,
        validators: { onChange: spoolSchema },
        onSubmit: async ({ value }) => {
            const now = new Date().toISOString();

            const spoolToSave: Spool = {
                id: editState.id,
                spoolCode: String(editState.id),
                ...value,
                firstUsedAt: null,
                lastUsedAt: null,
                createdAt:
                    editState.id > 0
                        ? spools.get(editState.id)?.createdAt || now
                        : now,
                updatedAt: now,
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

    const handleClose = useCallback(() => {
        form.reset();
        setEditState({ id: 0, isOpen: false, original: null });
    }, [form, setEditState]);

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

function SpoolListSection({
    spools,
    total,
    isFetching,
    templateOpen,
    search,
    sortBy,
    sortOrder,
    onSearch,
    onSort,
    onPageChange,
    currentPage,
    totalPages,
}: {
    spools: Map<number, Spool>;
    total: number;
    isFetching: boolean;
    templateOpen: boolean;
    search: string | undefined;
    sortBy: string | undefined;
    sortOrder: "asc" | "desc" | undefined;
    onSearch: (v: string) => void;
    onSort: (v: string) => void;
    onPageChange: (p: number) => void;
    currentPage: number;
    totalPages: number;
}) {
    const deleteMutation = useDeleteSpool();
    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);

    const handleDeleteConfirm = async () => {
        if (!deleteIntent) return;
        try {
            await deleteMutation.mutateAsync(deleteIntent.spoolId);
        } finally {
            setDeleteIntent(null);
        }
    };

    return (
        <>
            <div className="scroll flex items-center gap-2">
                <SpoolSearch onSearch={onSearch} />
                <div className="text-xs text-muted-foreground">
                    {isFetching
                        ? "Loading spools..."
                        : `Showing ${spools.size} of ${total} spools${
                              search ? ` matching "${search}"` : ""
                          }`}
                </div>
            </div>

            <SpoolTable
                isLoading={isFetching}
                spools={spools}
                templateOpen={templateOpen}
                onDelete={(id) => setDeleteIntent({ spoolId: id })}
                onEdit={() => {}}
                onDuplicate={() => {}}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
            />

            <SpoolPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={onPageChange}
            />

            {deleteIntent && (
                <DeleteSpoolDialog
                    intent={deleteIntent}
                    onIntentChange={setDeleteIntent}
                    onConfirm={handleDeleteConfirm}
                />
            )}
        </>
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
