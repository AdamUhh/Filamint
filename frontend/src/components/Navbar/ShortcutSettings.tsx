/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { tryParseJson } from "@/lib/util-format";
import { cn } from "@/lib/utils";

import { ShortcutService } from "@bindings";

interface Shortcut {
    id: number;
    category: string;
    description: string;
    keyCombo: string;
    action: string;
}

export function ShortcutsSettings() {
    const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
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
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchShortcuts();
    }, []);

    useEffect(() => {
        if (editingId !== null) inputRef.current?.focus();
    }, [editingId]);

    const handleCancel = () => {
        setEditingId(null);
        setEditValue("");
        setError("");
    };

    function validateShortcut(combo: string): {
        isValid: boolean;
        message?: string;
    } {
        if (!combo || combo.trim() === "") {
            return { isValid: false, message: "Shortcut cannot be empty." };
        }

        const parts = combo.split("+").map((p) => p.trim().toLowerCase());

        // Must contain at least one non-modifier key
        const modifiers = MODIFIER_KEYS.map((m) => m.toLowerCase());

        const hasNonModifier = parts.some((part) => !modifiers.includes(part));

        if (!hasNonModifier) {
            return {
                isValid: false,
                message: "Shortcut must include at least one non-modifier key.",
            };
        }

        return { isValid: true };
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
            handleCancel();
            return;
        }

        // Save on Enter
        if (e.key === "Enter" && editingId !== null) {
            handleSave(shortcuts.find((s) => s.id === editingId)?.action || "");
            return;
        }

        if (FORBIDDEN_KEYS.includes(e.key)) {
            setError(
                `"${e.key == " " ? "Space" : e.key}" is not allowed as a shortcut.`
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
        setEditValue(combo);
        setError("");
    };

    const handleSave = async (action: string) => {
        const validation = validateShortcut(editValue);

        if (!validation.isValid) {
            setError(validation.message ?? "");
            inputRef.current?.focus();
            return;
        }

        setIsLoading(true);

        try {
            await ShortcutService.UpdateShortcut(action, editValue);
            await fetchShortcuts();
            handleCancel();
        } catch (err: any) {
            setError(
                tryParseJson(err.message)?.message ??
                    err.message ??
                    "Unknown error"
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async (action: string) => {
        setIsLoading(true);
        try {
            await ShortcutService.ResetShortcut(action);
            await fetchShortcuts();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetAll = async () => {
        setIsLoading(true);
        try {
            await ShortcutService.ResetAllShortcuts();
            await fetchShortcuts();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

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

            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    {error}
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
                            const isEditing = editingId === shortcut.id;

                            return (
                                <TableRow key={shortcut.id}>
                                    <TableCell className="text-xs font-medium capitalize">
                                        {shortcut.category}
                                    </TableCell>
                                    <TableCell>
                                        {shortcut.description}
                                    </TableCell>
                                    <TableCell>
                                        {isEditing ? (
                                            <Input
                                                ref={inputRef}
                                                type="text"
                                                value={editValue}
                                                onKeyDown={handleKeyDown}
                                                readOnly
                                                placeholder="Press keys..."
                                                className={cn(
                                                    "h-7 w-48 cursor-pointer font-mono ring-2 ring-blue-500",
                                                    error && "ring-destructive"
                                                )}
                                            />
                                        ) : (
                                            <div className="w-48 font-mono text-xs tracking-widest">
                                                {shortcut.keyCombo}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {isEditing ? (
                                                <>
                                                    <Button
                                                        onClick={() =>
                                                            handleSave(
                                                                shortcut.action
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                        size="sm"
                                                    >
                                                        <CheckIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={handleCancel}
                                                        disabled={isLoading}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <XIcon className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        onClick={() => {
                                                            setEditingId(
                                                                shortcut.id
                                                            );
                                                            setEditValue(
                                                                shortcut.keyCombo
                                                            );
                                                            setError("");
                                                        }}
                                                        disabled={isLoading}
                                                        variant="ghost"
                                                        size="sm"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={() =>
                                                            handleReset(
                                                                shortcut.action
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                        variant="ghost"
                                                        size="sm"
                                                    >
                                                        <RotateCcwIcon className="h-4 w-4" />
                                                    </Button>
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
                {editingId !== null && (
                    <span className="text-sm text-blue-600">
                        Press your desired key combination. Press Escape to
                        cancel.
                    </span>
                )}
                <Button
                    onClick={handleResetAll}
                    disabled={isLoading}
                    variant="outline"
                    className={editingId === null ? "ml-auto" : ""}
                >
                    <RotateCcwIcon className="mr-2 h-4 w-4" />
                    Reset All to Defaults
                </Button>
            </div>
        </section>
    );
}
