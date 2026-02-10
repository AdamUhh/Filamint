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
import { Checkbox } from "@/shadcn/checkbox";
import { Label } from "@/shadcn/label";

export type DeleteState = {
    printId: number;
    restoreSpoolGrams: boolean;
};

type DeletePrintDialogProps = {
    intent: DeleteState | null;
    onIntentChange: (intent: DeleteState | null) => void;
    onConfirm: () => void;
};

export function DeletePrintDialog({
    intent,
    onIntentChange,
    onConfirm,
}: DeletePrintDialogProps) {
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
                        delete the print.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex items-start gap-2 pt-2">
                    <Checkbox
                        id="restore-spools"
                        checked={intent?.restoreSpoolGrams ?? false}
                        onCheckedChange={(checked) =>
                            intent &&
                            onIntentChange({
                                ...intent,
                                restoreSpoolGrams: checked === true,
                            })
                        }
                    />
                    <Label htmlFor="terms-checkbox">
                        Restore used grams back to spools
                    </Label>
                </div>

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
