import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { toast } from "sonner";

import { type UpdateInfo, UpdateService } from "@bindings";

export function Updater() {
    useEffect(() => {
        const unsubscribe = Events.On("updater:available", (event) => {
            const info = event.data as UpdateInfo;
            toast.success(`Update available — v${info.newVersion}`, {
                description: info.notes,
                duration: Infinity,
                action: {
                    label: "Update",
                    onClick: () =>
                        UpdateService.DownloadAndInstall(info.downloadUrl),
                },
            });
        });
        return () => {
            unsubscribe();
        };
    }, []);

    return null;
}
