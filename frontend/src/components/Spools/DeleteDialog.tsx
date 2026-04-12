import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shadcn/alert-dialog";

import { formatGrams } from "@/lib/util-format";

import { useSpoolPrints } from "./lib/fetch-hooks";

export type DeleteState = {
    spoolId: number;
};

type DeletePrintDialogProps = {
    intent: DeleteState | null;
    onIntentChange: (intent: DeleteState | null) => void;
    onConfirm: () => void;
};

export function DeleteSpoolDialog({
    intent,
    onIntentChange,
    onConfirm,
}: DeletePrintDialogProps) {
    const { data } = useSpoolPrints(intent!.spoolId);

    return (
        <AlertDialog
            open={intent !== null}
            onOpenChange={(open) => {
                if (!open) onIntentChange(null);
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the spool.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {data && data.length > 0 && (
                    <div className="mt-3 text-sm">
                        <p className="mb-2 text-muted-foreground">
                            Deleting this spool will affect these prints:
                        </p>

                        <ul className="max-h-[50vh] overflow-auto rounded-md border">
                            {data.map((s) => (
                                <li
                                    key={s.printId}
                                    className="flex justify-between px-3 py-1.5 odd:bg-muted/40 even:bg-background"
                                >
                                    <span className="capitalize">
                                        {s.printName}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {formatGrams(s.gramsUsed)}g
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
