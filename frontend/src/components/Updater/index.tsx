import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { toast } from "sonner";

// Check on demand
// async function checkForUpdates() {
//     const info = await UpdateService.CheckForUpdate();
//     if (info.available) {
//         // Show dialog to user
//         showUpdateDialog(info);
//     }
// }

// // Start download+install
// async function applyUpdate(downloadUrl: string) {
//     await UpdateService.DownloadAndInstall(downloadUrl);
// }

export function Updater() {
    useEffect(() => {
        // Listen for background check result
        Events.On("updater:available", (info) => {
            console.log("update available", info.data);
            toast.success("Update Available", info.data);
        });
    }, []);

    return null;
}
