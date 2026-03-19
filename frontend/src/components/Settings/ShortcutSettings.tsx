import { ShortcutService } from "@bindings/shortcuts";
import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LazyTooltip } from "@/shadcn/custom/lazy-tooltip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    FORBIDDEN_KEYS,
    MODIFIER_KEYS,
    SPECIAL_KEYS,
} from "@/lib/constant-mod-keys";
import { toErrorMessage } from "@/lib/util-format";
import { cn } from "@/lib/utils";

interface Shortcut {
    id: number;
    category: string;
    description: string;
    keyCombo: string;
    action: string;
}

interface EditState {
    id: number;
    action: string;
    value: string;
    validationError: string;
}

export function ShortcutsSettings() {
    const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

    const [editState, setEditState] = useState<EditState | null>(null);
    const [apiError, setApiError] = useState("");

    const [pendingActions, setPendingActions] = useState<Set<string>>(
        new Set()
    );

    // Separate flag for bulk operations (reset all)
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const [confirmResetAll, setConfirmResetAll] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const fetchShortcuts = async () => {
        try {
            const data = await ShortcutService.GetAllShortcuts();
            setShortcuts(
                data.sort(
                    (a, b) =>
                        a.category.localeCompare(b.category) ||
                        a.action.localeCompare(b.action)
                )
            );
        } catch (err) {
            setApiError(toErrorMessage(err));
        }
    };

    useEffect(() => {
        fetchShortcuts();
    }, []);

    useEffect(() => {
        if (editState !== null) inputRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editState?.id]);

    const isActionPending = (action: string) => pendingActions.has(action);

    const startPendingAction = (action: string) =>
        setPendingActions((prev) => new Set(prev).add(action));

    const stopPendingAction = (action: string) =>
        setPendingActions((prev) => {
            const next = new Set(prev);
            next.delete(action);
            return next;
        });

    const handleCancel = () => {
        setEditState(null);
        setApiError("");
    };

    function validateShortcut(combo: string): string | null {
        if (!combo || combo.trim() === "") {
            return "Shortcut cannot be empty.";
        }
        const parts = combo.split("+").map((p) => p.trim().toLowerCase());
        const modifiers = MODIFIER_KEYS.map((m) => m.toLowerCase());
        const hasNonModifier = parts.some((part) => !modifiers.includes(part));
        if (!hasNonModifier) {
            return "Shortcut must include at least one non-modifier key.";
        }
        return null;
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
            handleCancel();
            return;
        }

        if (e.key === "Enter" && editState !== null) {
            handleSave();
            return;
        }

        if (FORBIDDEN_KEYS.includes(e.key)) {
            setEditState((prev) =>
                prev
                    ? {
                          ...prev,
                          validationError: `"${e.key === " " ? "Space" : e.key}" is not allowed as a shortcut.`,
                      }
                    : prev
            );
            return;
        }

        const parts: string[] = [];

        if (e.metaKey) parts.push("Cmd");
        else if (e.ctrlKey) parts.push("Ctrl");

        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");

        const key = e.key;

        if (!MODIFIER_KEYS.includes(key)) {
            if (key.startsWith("F") && key.length <= 3) {
                parts.push(key.toUpperCase());
            } else if (key.length === 1) {
                parts.push(key.toUpperCase());
            } else if (SPECIAL_KEYS.includes(key)) {
                parts.push(key);
            }
        }

        const combo = parts.join("+");
        setEditState((prev) =>
            prev ? { ...prev, value: combo, validationError: "" } : prev
        );
    };

    const handleSave = async () => {
        if (!editState) return;

        const validationError = validateShortcut(editState.value);
        if (validationError) {
            setEditState((prev) =>
                prev ? { ...prev, validationError } : prev
            );
            inputRef.current?.focus();
            return;
        }

        startPendingAction(editState.action);
        try {
            await ShortcutService.UpdateShortcut(
                editState.action,
                editState.value
            );
            await fetchShortcuts();
            handleCancel();
        } catch (err) {
            setApiError(toErrorMessage(err));
        } finally {
            stopPendingAction(editState.action);
        }
    };

    const handleReset = async (action: string) => {
        setApiError("");
        startPendingAction(action);
        try {
            await ShortcutService.ResetShortcut(action);
            await fetchShortcuts();
        } catch (err) {
            setApiError(toErrorMessage(err));
        } finally {
            stopPendingAction(action);
        }
    };

    const handleResetAll = async () => {
        if (!confirmResetAll) {
            setConfirmResetAll(true);
            return;
        }
        setConfirmResetAll(false);

        setApiError("");
        setIsBulkLoading(true);
        try {
            await ShortcutService.ResetAllShortcuts();
            await fetchShortcuts();
        } catch (err) {
            setApiError(toErrorMessage(err));
        } finally {
            setIsBulkLoading(false);
        }
    };

    const isEditing = editState !== null;

    return (
        <section className="space-y-3">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Shortcuts
                </h2>
                <p className="text-sm text-muted-foreground">
                    Configure your app shortcuts.
                </p>
            </div>

            {apiError && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    {apiError}
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Shortcut</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shortcuts.map((shortcut) => {
                            const isRowEditing = editState?.id === shortcut.id;
                            // Visually dim other rows while a row is being edited.
                            const isRowDisabled = isEditing && !isRowEditing;
                            const rowLoading =
                                isActionPending(shortcut.action) ||
                                isBulkLoading;

                            return (
                                <TableRow
                                    key={shortcut.id}
                                    className={cn(
                                        isRowDisabled &&
                                            "pointer-events-none opacity-40"
                                    )}
                                >
                                    <TableCell className="text-xs font-medium capitalize">
                                        {shortcut.category}
                                    </TableCell>
                                    <TableCell>
                                        {shortcut.description}
                                    </TableCell>
                                    <TableCell>
                                        {isRowEditing ? (
                                            <div className="flex flex-col gap-1">
                                                <Input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={editState.value}
                                                    onKeyDown={handleKeyDown}
                                                    readOnly
                                                    placeholder="Press keys..."
                                                    className={cn(
                                                        "h-7 w-48 cursor-pointer font-mono ring-2 ring-blue-500",
                                                        editState.validationError &&
                                                            "ring-destructive"
                                                    )}
                                                />
                                                {editState.validationError && (
                                                    <p className="text-xs text-destructive">
                                                        {
                                                            editState.validationError
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-48 font-mono text-xs tracking-widest">
                                                {shortcut.keyCombo}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {isRowEditing ? (
                                                <>
                                                    <Button
                                                        onClick={handleSave}
                                                        disabled={rowLoading}
                                                        size="sm"
                                                    >
                                                        <CheckIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={handleCancel}
                                                        disabled={rowLoading}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <XIcon className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <LazyTooltip
                                                        content={`Edit Shortcut: ${shortcut.action}`}
                                                    >
                                                        <Button
                                                            onClick={() => {
                                                                setEditState({
                                                                    id: shortcut.id,
                                                                    // FIX #7: Capture action up front.
                                                                    action: shortcut.action,
                                                                    value: shortcut.keyCombo,
                                                                    validationError:
                                                                        "",
                                                                });
                                                                setApiError("");
                                                            }}
                                                            disabled={
                                                                rowLoading ||
                                                                isBulkLoading
                                                            }
                                                            variant="ghost"
                                                            size="sm"
                                                        >
                                                            <PencilIcon className="h-4 w-4" />
                                                        </Button>
                                                    </LazyTooltip>

                                                    <LazyTooltip
                                                        content={`Reset Shortcut: ${shortcut.action}`}
                                                    >
                                                        <Button
                                                            onClick={() =>
                                                                handleReset(
                                                                    shortcut.action
                                                                )
                                                            }
                                                            disabled={
                                                                rowLoading ||
                                                                isBulkLoading
                                                            }
                                                            variant="ghost"
                                                            size="sm"
                                                        >
                                                            <RotateCcwIcon className="h-4 w-4" />
                                                        </Button>
                                                    </LazyTooltip>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                {isEditing && (
                    <span className="text-sm text-blue-600">
                        Press your desired key combination. Press Escape to
                        cancel, Enter to submit.
                    </span>
                )}

                {confirmResetAll ? (
                    <div
                        className={cn(
                            "flex items-center gap-2",
                            !isEditing && "ml-auto"
                        )}
                    >
                        <span className="text-sm text-muted-foreground">
                            Reset all shortcuts to defaults?
                        </span>
                        <Button
                            onClick={handleResetAll}
                            disabled={isBulkLoading}
                            variant="destructive"
                            size="sm"
                        >
                            Confirm reset
                        </Button>
                        <Button
                            onClick={() => setConfirmResetAll(false)}
                            disabled={isBulkLoading}
                            variant="outline"
                            size="sm"
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={handleResetAll}
                        disabled={isBulkLoading || isEditing}
                        variant="outline"
                        className={!isEditing ? "ml-auto" : ""}
                    >
                        <RotateCcwIcon className="mr-2 h-4 w-4" />
                        Reset All to Defaults
                    </Button>
                )}
            </div>
        </section>
    );
}
