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
