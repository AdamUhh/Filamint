import { useApp } from "@/context/useContext";
import { AlertCircleIcon, ExternalLinkIcon, FileIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { Checkbox } from "@/shadcn/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shadcn/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shadcn/table";

import { formatBytesToMB } from "@/lib/util-format";

import { PrintModel, PrintService } from "@bindings";

type Step = "models" | "app";

export function OpenInAppDialog({
    openInAppState,
    setOpenInAppState,
}: {
    openInAppState: { printId: number | null; open: boolean };
    setOpenInAppState: React.Dispatch<
        React.SetStateAction<{ printId: number | null; open: boolean }>
    >;
}) {
    const { printId, open } = openInAppState;
    const { options } = useApp();

    const [step, setStep] = useState<Step>("models");
    const [models, setModels] = useState<PrintModel[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [openErrors, setOpenErrors] = useState<
        { name: string; error: string }[]
    >([]);

    const apps = options.openInApp ?? [];

    useEffect(() => {
        if (!open || printId == null) return;

        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        setStep("models");
        setFetchError(null);
        setOpenErrors([]);

        PrintService.GetPrintModels(printId)
            .then((data) => {
                if (!cancelled) {
                    setModels(data ?? []);
                    setSelected(new Set());
                    setIsLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setFetchError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load models. Please try again."
                    );
                    setModels([]);
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, printId]);

    const handleSelectAll = (checked: boolean) => {
        setSelected(checked ? new Set(models.map((m) => m.id)) : new Set());
    };

    const handleSelect = (id: number, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            checked ? next.add(id) : next.delete(id);
            return next;
        });
    };

    const handleChooseApp = async (path: string) => {
        const selectedModels = models.filter((m) => selected.has(m.id));
        const errors: { name: string; error: string }[] = [];

        await Promise.all(
            selectedModels.map(async (m) => {
                try {
                    await PrintService.OpenInApp(`${m.id}.${m.ext}`, path);
                } catch (err: unknown) {
                    errors.push({
                        name: `${m.name}.${m.ext}`,
                        error:
                            err instanceof Error
                                ? JSON.parse(err.message)?.message
                                : "Failed to open file.",
                    });
                }
            })
        );

        if (errors.length > 0) {
            setOpenErrors(errors);
        } else {
            setOpenInAppState({ open: false, printId: null });
        }
    };

    const handleDialogChange = (open: boolean) => {
        setOpenInAppState({ open, printId: open ? printId : null });
    };

    const allChecked = models.length > 0 && selected.size === models.length;

    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogContent className="sm:max-w-xl">
                {step === "models" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                View Print Models
                            </DialogTitle>
                            <DialogDescription>
                                Select one or more models to open.
                            </DialogDescription>
                        </DialogHeader>

                        {fetchError ? (
                            <FetchError
                                message={fetchError}
                                onRetry={() => {
                                    setFetchError(null);
                                    setIsLoading(true);
                                    PrintService.GetPrintModels(printId!)
                                        .then((data) => {
                                            setModels(data ?? []);
                                            setSelected(new Set());
                                            setIsLoading(false);
                                        })
                                        .catch((err: unknown) => {
                                            setFetchError(
                                                err instanceof Error
                                                    ? err.message
                                                    : "Failed to load models. Please try again."
                                            );
                                            setIsLoading(false);
                                        });
                                }}
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={allChecked}
                                                onCheckedChange={(v) =>
                                                    handleSelectAll(!!v)
                                                }
                                                title="Select all"
                                            />
                                        </TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="w-14 text-right">
                                            Ext
                                        </TableHead>
                                        <TableHead className="w-20 text-right">
                                            Size
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <>
                                            <ViewPrintLoader />
                                            <ViewPrintLoader />
                                            <ViewPrintLoader />
                                        </>
                                    ) : models.length === 0 ? (
                                        <ViewPrintNoModels />
                                    ) : (
                                        models.map((model) => (
                                            <TableRow
                                                key={model.id}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    handleSelect(
                                                        model.id,
                                                        !selected.has(model.id)
                                                    )
                                                }
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selected.has(
                                                            model.id
                                                        )}
                                                        onCheckedChange={(v) =>
                                                            handleSelect(
                                                                model.id,
                                                                !!v
                                                            )
                                                        }
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        aria-label={`Select ${model.name}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="max-w-0 truncate font-medium">
                                                    {model.name}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-muted-foreground uppercase">
                                                    .{model.ext}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground tabular-nums">
                                                    {formatBytesToMB(
                                                        model.size
                                                    )}{" "}
                                                    MB
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setOpenInAppState({
                                        printId: null,
                                        open: false,
                                    })
                                }
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={selected.size === 0 || !!fetchError}
                                onClick={() => setStep("app")}
                            >
                                <ExternalLinkIcon className="mb-0.5" />
                                Open In...
                                {selected.size > 0 && ` (${selected.size})`}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Open With</DialogTitle>
                            <DialogDescription>
                                Choose an app to open the selected models.
                            </DialogDescription>
                        </DialogHeader>

                        {openErrors.length > 0 && (
                            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                                <div className="mb-1.5 flex items-center gap-1.5 font-medium text-destructive">
                                    <AlertCircleIcon className="h-4 w-4 shrink-0" />
                                    Failed to open{" "}
                                    {openErrors.length === 1
                                        ? "1 file"
                                        : `${openErrors.length} files`}
                                </div>
                                <ul className="space-y-0.5 text-muted-foreground">
                                    {openErrors.map(({ name, error }) => (
                                        <li key={name}>
                                            <span className="font-mono font-medium">
                                                {name}
                                            </span>
                                            : {error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 py-2">
                            {apps.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No apps configured. Add one in Settings{" "}
                                    {"->"} Open In App
                                </p>
                            ) : (
                                apps.map((rec) => {
                                    const [[name, path]] = Object.entries(rec);
                                    return (
                                        <Button
                                            key={name}
                                            variant="outline"
                                            className="h-auto w-full px-4 py-3"
                                            onClick={() =>
                                                handleChooseApp(path)
                                            }
                                        >
                                            <ExternalLinkIcon className="mr-2 h-4 w-4 shrink-0" />
                                            <div className="flex w-full flex-col items-start text-left">
                                                <span className="font-medium">
                                                    {name}
                                                </span>
                                                <span className="font-mono text-xs break-all whitespace-pre-line text-muted-foreground">
                                                    {path}
                                                </span>
                                            </div>
                                        </Button>
                                    );
                                })
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setStep("models");
                                    setOpenErrors([]);
                                }}
                            >
                                Back
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function FetchError({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircleIcon className="h-8 w-8 text-destructive opacity-80" />
            <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                    Failed to load models
                </p>
                <p className="text-xs text-muted-foreground">{message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
            </Button>
        </div>
    );
}

function ViewPrintLoader() {
    return (
        <TableRow className="animate-pulse">
            <TableCell>
                <div className="h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700" />
            </TableCell>
            <TableCell>
                <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700" />
            </TableCell>
            <TableCell>
                <div className="h-4 w-14 rounded bg-zinc-200 dark:bg-zinc-700" />
            </TableCell>
            <TableCell>
                <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
            </TableCell>
        </TableRow>
    );
}

function ViewPrintNoModels() {
    return (
        <TableRow>
            <TableCell colSpan={4}>
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                    <FileIcon className="h-8 w-8 opacity-30" />
                    <span>No models found</span>
                </div>
            </TableCell>
        </TableRow>
    );
}
