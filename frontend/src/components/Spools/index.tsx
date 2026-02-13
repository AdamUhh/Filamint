import { useApp } from "@/context/useContext";
import { useKeyCombos } from "@/hooks/useKeyCombo";
import { usePaginatedSpools } from "@/hooks/usePaginatedSpools";
import { Events } from "@wailsio/runtime";
import { format } from "date-fns";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
    MenuIcon,
    PlusIcon,
    SearchIcon,
    SlidersHorizontalIcon,
    StarIcon,
    XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/shadcn/badge";
import { Button } from "@/shadcn/button";
import { ButtonGroup } from "@/shadcn/button-group";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";
import { Input } from "@/shadcn/input";
import { Label } from "@/shadcn/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shadcn/select";
import { Separator } from "@/shadcn/separator";
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
    const {
        updateSpoolOptimistic,
        deleteSpoolOptimistic,
        addSpoolOptimistic,
        refreshSpools,
    } = useApp();

    const [editState, setEditState] = useState<EditState>({
        isOpen: false,
        id: 0,
        original: null,
    });
    const [deleteIntent, setDeleteIntent] = useState<DeleteState | null>(null);
    const [templateOpen, setTemplateOpen] = useState(false);

    // Pagination and search
    const {
        spools: paginatedSpools,
        total,
        currentPage,
        pageSize,
        totalPages,
        filter,
        isLoading,
        goToPage,
        nextPage,
        previousPage,
        updateFilter,
        clearFilter,
        updatePageSize,
        refresh,
    } = usePaginatedSpools({
        initialPageSize: 20,
        initialFilter: {
            sortBy: "updated_at",
            sortDesc: true,
            isTemplate: templateOpen ? true : null,
            colors: [],
            materials: [],
            maxWeight: null,
            minWeight: null,
            searchTerm: "",
            vendors: [],
        },
    });

    // Update filter when template view changes
    useEffect(() => {
        updateFilter({
            isTemplate: templateOpen ? true : undefined,
        });
    }, [templateOpen, updateFilter]);

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
                        ? editState.original?.createdAt || now
                        : now,
                updatedAt: now,
            };

            try {
                if (editState.id > 0) {
                    // Optimistic update
                    updateSpoolOptimistic(spoolToSave);
                    await SpoolService.UpdateSpool(spoolToSave);
                } else {
                    // Create - backend will assign real ID
                    const newId = await SpoolService.CreateSpool(spoolToSave);
                    spoolToSave.id = newId;
                    addSpoolOptimistic(spoolToSave);
                }

                setEditState({ id: 0, isOpen: false, original: null });
                form.reset();
                refresh(); // Refresh paginated view
                refreshSpools(); // Refresh global context
            } catch (err) {
                console.error("Failed to save spool:", err);
                // Rollback optimistic update on error
                if (editState.id > 0 && editState.original) {
                    updateSpoolOptimistic(editState.original);
                }
            }
        },
    });

    const handleViewTemplate = useCallback(() => {
        setTemplateOpen((prev) => !prev);
        goToPage(1); // Reset to first page when switching views
    }, [goToPage]);

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
            // Optimistic delete
            deleteSpoolOptimistic(deleteIntent.spoolId);
            await SpoolService.DeleteSpool(deleteIntent.spoolId);
            refresh();
            refreshSpools();
        } catch (error) {
            console.error("Failed to delete spool:", error);
            // TODO: Show error toast and refresh to restore state
            refresh();
        } finally {
            setDeleteIntent(null);
        }
    };

    const handleCloseDialog = useCallback(() => {
        form.reset();
        setEditState({ id: 0, isOpen: false, original: null });
    }, [form]);

    console.debug("errors! : ", form.state.isValid, form.state.errors);

    return (
        <div className="space-y-6 p-6">
            <SpoolHeader
                onCreate={handleCreate}
                templateOpen={templateOpen}
                onViewTemplate={handleViewTemplate}
            />

            <SearchAndFilters
                filter={filter}
                updateFilter={updateFilter}
                clearFilter={clearFilter}
                templateOpen={templateOpen}
            />

            <ResultsInfo
                showing={paginatedSpools.length}
                total={total}
                currentPage={currentPage}
                pageSize={pageSize}
                isLoading={isLoading}
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading spools...</p>
                </div>
            ) : paginatedSpools.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-2 py-12">
                    <p className="text-muted-foreground">No spools found</p>
                    {(filter.searchTerm ||
                        filter.vendors?.length ||
                        filter.materials?.length) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilter}
                        >
                            Clear filters
                        </Button>
                    )}
                </div>
            ) : (
                <SpoolTable
                    spools={new Map(paginatedSpools.map((s) => [s.id, s]))}
                    templateOpen={templateOpen}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                />
            )}

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPreviousPage={previousPage}
                onNextPage={nextPage}
                onGoToPage={goToPage}
                onPageSizeChange={updatePageSize}
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

function SearchAndFilters({
    filter,
    updateFilter,
    clearFilter,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateFilter: (f: any) => void;
    clearFilter: () => void;
    templateOpen: boolean;
}) {
    const [searchInput, setSearchInput] = useState(filter.searchTerm || "");
    const [filtersOpen, setFiltersOpen] = useState(false);

    // Debounce search - update filter after user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            updateFilter({ searchTerm: searchInput || undefined });
        }, 300);

        return () => clearTimeout(timer);
    }, [searchInput, updateFilter]);

    const hasActiveFilters =
        filter.searchTerm ||
        filter.vendors?.length > 0 ||
        filter.materials?.length > 0 ||
        filter.colors?.length > 0 ||
        filter.minWeight !== undefined ||
        filter.maxWeight !== undefined;

    return (
        <div className="flex gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
                <SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search spools..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pr-9 pl-9"
                />
                {searchInput && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                        onClick={() => setSearchInput("")}
                    >
                        <XIcon className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Sort Selector */}
            <Select
                value={filter.sortBy || "updated_at"}
                onValueChange={(value) => updateFilter({ sortBy: value })}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="updated_at">Last Updated</SelectItem>
                    <SelectItem value="created_at">Date Created</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="color">Color</SelectItem>
                    <SelectItem value="remaining_weight">
                        Remaining Weight
                    </SelectItem>
                    <SelectItem value="cost">Cost</SelectItem>
                </SelectContent>
            </Select>

            {/* Sort Direction Toggle */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                            updateFilter({ sortDesc: !filter.sortDesc })
                        }
                    >
                        {filter.sortDesc ? "↓" : "↑"}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{filter.sortDesc ? "Descending" : "Ascending"}</p>
                </TooltipContent>
            </Tooltip>

            {/* Advanced Filters */}
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="relative">
                        <SlidersHorizontalIcon className="h-4 w-4" />
                        Filters
                        {hasActiveFilters && (
                            <Badge
                                variant="secondary"
                                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
                            >
                                !
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium">Advanced Filters</h4>
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        clearFilter();
                                        setSearchInput("");
                                        setFiltersOpen(false);
                                    }}
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>

                        <Separator />

                        {/* Weight Range Filter */}
                        <div className="space-y-2">
                            <Label>Remaining Weight (grams)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Min"
                                    value={filter.minWeight || ""}
                                    onChange={(e) =>
                                        updateFilter({
                                            minWeight: e.target.value
                                                ? Number(e.target.value)
                                                : undefined,
                                        })
                                    }
                                />
                                <Input
                                    type="number"
                                    placeholder="Max"
                                    value={filter.maxWeight || ""}
                                    onChange={(e) =>
                                        updateFilter({
                                            maxWeight: e.target.value
                                                ? Number(e.target.value)
                                                : undefined,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        {/* Note: Add vendor/material/color multi-select filters here if needed */}
                        {/* You'll need to fetch unique values from backend or derive from cache */}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

function ResultsInfo({
    showing,
    total,
    currentPage,
    pageSize,
    isLoading,
}: {
    showing: number;
    total: number;
    currentPage: number;
    pageSize: number;
    isLoading: boolean;
}) {
    if (isLoading) return null;

    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(start + showing - 1, total);

    return (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
                Showing {start}-{end} of {total} spool{total !== 1 ? "s" : ""}
            </p>
        </div>
    );
}

function PaginationControls({
    currentPage,
    totalPages,
    pageSize,
    onPreviousPage,
    onNextPage,
    onGoToPage,
    onPageSizeChange,
}: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
    onGoToPage: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">
                    Items per page:
                </Label>
                <Select
                    value={String(pageSize)}
                    onValueChange={(value) => onPageSizeChange(Number(value))}
                >
                    <SelectTrigger className="w-[100px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                </span>

                <ButtonGroup>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => onGoToPage(1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronsLeftIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>First page</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={onPreviousPage}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Previous page</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={onNextPage}
                                disabled={currentPage >= totalPages}
                            >
                                <ChevronRightIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Next page</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => onGoToPage(totalPages)}
                                disabled={currentPage >= totalPages}
                            >
                                <ChevronsRightIcon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Last page</TooltipContent>
                    </Tooltip>
                </ButtonGroup>
            </div>
        </div>
    );
}
