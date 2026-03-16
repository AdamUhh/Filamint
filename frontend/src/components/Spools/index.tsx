import type { Spool, SpoolQueryParams } from "@bindings/services";
import { MenuIcon, PlusIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";

import { AppPagination } from "@/components/Pagination";
import { AppSearch } from "@/components/Search";
import {
    DeleteSpoolDialog,
    type DeleteState,
} from "@/components/Spools/DeleteDialog";
import { SpoolTable } from "@/components/Spools/SpoolTable";
import { PAGE_SIZE } from "@/components/Spools/lib/defaults";
import {
    useDeleteSpool,
    useSpoolEvents,
    useSpools,
} from "@/components/Spools/lib/fetch-hooks";

import { useKeyCombos } from "@/hooks/useKeyCombo";

import { SpoolFormDialog } from "./Form";
import type { EditState } from "./lib/types";

export default function SpoolsPage() {
    const [templateOpen, setTemplateOpen] = useState(false);
    const navigate = useNavigate();

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
        } finally {
            setDeleteIntent(null);
        }
    };

    const handleLogAPrint = (spool: Spool) => {
        navigate(`/prints?spoolId=${spool.id}`);
    };

    return (
        <div className="space-y-6 p-6">
            <SpoolHeader
                templateOpen={templateOpen}
                onViewTemplate={handleViewTemplate}
                onCreate={handleCreate}
            />
            <div className="flex items-start justify-between">
                <div className="relative flex w-fit min-w-100 gap-2">
                    <AppSearch
                        onSearch={handleSearch}
                        qualifierKeys={["vendor", "spool", "material", "color"]}
                    />
                    <div className="absolute -top-4.5 right-6 text-xs text-muted-foreground/80">
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
                onLogAPrint={handleLogAPrint}
                sortBy={queryParams.sortBy}
                sortOrder={queryParams.sortOrder as "asc" | "desc"}
                onSort={handleSort}
            />

            <SpoolFormDialog
                editState={editState}
                setEditState={setEditState}
            />

            {deleteIntent && deleteIntent.spoolId && (
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
