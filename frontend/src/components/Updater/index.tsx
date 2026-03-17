import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { toast } from "sonner";

import { UpdateService } from "@bindings/updater";

export function Updater() {
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const info = await UpdateService.CheckForUpdate();
                if (cancelled || !info?.available) return;

                toast.success(`New update available - v${info.newVersion}`, {
                    duration: Infinity,
                    action: {
                        label: "Update",
                        onClick: () =>
                            UpdateService.DownloadAndInstall(info.downloadUrl),
                    },
                });
            } catch (err) {
                console.error("Update check failed", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        Events.On("updater:restart", () =>
            toast.success(`Restart to update`, {
                duration: Infinity,
                action: {
                    label: "Restart",
                    onClick: () => UpdateService.RestartApp(),
                },
            })
        );
    }, []);

    return null;
}
