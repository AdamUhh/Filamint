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
        const unsubscribe = Events.On("updater:fail", () =>
            toast.error("Update Failed", {
                duration: Infinity,
                description: "Check logs to know why",
                action: {
                    label: "View Logs",
                    onClick: () => SpoolService.OpenDBDir(),
                },
            })
        );

        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const unsubscribe = Events.On("updater:restart", () =>
            toast.success("Restart to update", {
                duration: Infinity,
                action: {
                    label: "Restart",
                    onClick: () => UpdateService.RestartApp(),
                },
            })
        );

        return () => {
            unsubscribe();
        };
    }, []);

    return null;
}
