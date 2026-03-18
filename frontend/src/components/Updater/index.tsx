import { SpoolService } from "@bindings/services";
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

                toast.info(`New update available - v${info.newVersion}`, {
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
        let toastId: string | number | undefined;

        const unsubProgress = Events.On("updater:progress", (ev) => {
            const p = ev.data as {
                percent: number;
                bytesDownloaded: number;
                totalBytes: number;
            };
            if (toastId === undefined) {
                toastId = toast.loading(`Downloading update... ${p.percent}%`, {
                    duration: Infinity,
                });
            } else {
                toast.loading(`Downloading update... ${p.percent}%`, {
                    id: toastId,
                    duration: Infinity,
                });
            }
        });

        const unsubRestart = Events.On("updater:restart", () => {
            toast.success("Restart to update", {
                id: toastId,
                duration: Infinity,
                action: {
                    label: "Restart",
                    onClick: () => UpdateService.RestartApp(),
                },
            });
        });

        const unsubFail = Events.On("updater:fail", () => {
            toast.error("Update Failed", {
                id: toastId,
                duration: Infinity,
                description: "Try checking the logs",
                action: {
                    label: "View Logs",
                    onClick: () => SpoolService.OpenDBDir(),
                },
            });
        });

        return () => {
            unsubProgress();
            unsubRestart();
            unsubFail();
        };
    }, []);

    return null;
}
