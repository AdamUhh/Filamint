/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
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

import { ShortcutService } from "@bindings";

interface Shortcut {
    id: number;
    category: string;
    description: string;
    keyCombo: string;
    action: string;
}

export function ShortcutsSettingsSimple() {
    const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchShortcuts = async () => {
        try {
            const data = await ShortcutService.GetAllShortcuts();
            setShortcuts(data);
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchShortcuts();
    }, []);

    useEffect(() => {
        // Auto-focus input when editing starts
        if (editingId !== null && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    const handleEdit = (shortcut: Shortcut) => {
        setEditingId(shortcut.id);
        setEditValue(shortcut.keyCombo);
        setError("");
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditValue("");
        setError("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();

        // Allow Escape to cancel
        if (e.key === "Escape") {
            handleCancel();
            return;
        }

        const parts: string[] = [];

        // Add modifiers
        if (e.ctrlKey || e.metaKey) {
            parts.push(e.metaKey ? "Cmd" : "Ctrl");
        }
        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");

        const key = e.key;

        // Only add the key if it's not a modifier itself
        if (
            key !== "Control" &&
            key !== "Meta" &&
            key !== "Alt" &&
            key !== "Shift"
        ) {
            // Handle function keys (F1-F12)
            if (key.startsWith("F") && key.length <= 3) {
                parts.push(key.toUpperCase());
            }
            // Handle single character keys
            else if (key.length === 1) {
                parts.push(key.toUpperCase());
            }
            // Handle special keys
            else if (
                [
                    "Enter",
                    "Space",
                    "Tab",
                    "Backspace",
                    "Delete",
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "PageUp",
                    "PageDown",
                ].includes(key)
            ) {
                parts.push(key);
            }
        }

        // Only update if we have a valid combination (not just modifiers)
        if (
            parts.length > 0 &&
            parts[parts.length - 1] !== "Cmd" &&
            parts[parts.length - 1] !== "Ctrl" &&
            parts[parts.length - 1] !== "Alt" &&
            parts[parts.length - 1] !== "Shift"
        ) {
            const combo = parts.join("+");
            setEditValue(combo);
        }
    };

    const handleSave = async (action: string) => {
        setIsLoading(true);
        try {
            await ShortcutService.UpdateShortcut(action, editValue);
            await fetchShortcuts();
            setEditingId(null);
            setEditValue("");
        } catch (err: any) {
            setError(err.message);
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
        <div>
            <h1 className="mb-2 text-2xl font-bold">Keyboard Shortcuts</h1>

            {error && (
                <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
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
                                                className="h-7 w-48 cursor-pointer font-mono ring-2 ring-blue-500"
                                            />
                                        ) : (
                                            <div className="w-48">
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono"
                                                >
                                                    {shortcut.keyCombo}
                                                </Badge>
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
                                                        onClick={() =>
                                                            handleEdit(shortcut)
                                                        }
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

            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {editingId !== null && (
                        <span className="text-blue-600">
                            Press your desired key combination. Press Escape to
                            cancel.
                        </span>
                    )}
                </div>
                <Button
                    onClick={handleResetAll}
                    disabled={isLoading}
                    variant="outline"
                >
                    <RotateCcwIcon className="mr-2 h-4 w-4" />
                    Reset All to Defaults
                </Button>
            </div>
        </div>
    );
}
