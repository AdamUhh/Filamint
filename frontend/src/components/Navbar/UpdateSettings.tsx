import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";

import { Button } from "@/shadcn/button";
import { Separator } from "@/shadcn/separator";

import { cn } from "@/lib/utils";

import { UpdateService } from "@bindings/updater";

type UpdateState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "upToDate" }
    | {
          status: "available";
          newVersion: string;
          notes: string;
          pubDate: string;
          downloadUrl: string;
      }
    | { status: "downloading"; percent: number }
    | { status: "error"; message: string };

interface DownloadProgress {
    bytesDownloaded: number;
    totalBytes: number;
    percent: number;
}

export function UpdateSettings() {
    const [state, setState] = useState<UpdateState>({ status: "idle" });

    useEffect(() => {
        // Live download progress from Go's OnProgress callback → app.Event.Emit("updater:progress", p)
        const offProgress = Events.On("updater:progress", (event) => {
            const p = event.data as DownloadProgress;
            setState({ status: "downloading", percent: p.percent });
        });

        return () => {
            offProgress();
        };
    }, []);

    async function handleCheck() {
        setState({ status: "checking" });
        try {
            const info = await UpdateService.CheckForUpdate();
            if (!info || !info.available) {
                setState({ status: "upToDate" });
                return;
            }
            setState({
                status: "available",
                newVersion: info.newVersion,
                notes: info.notes,
                pubDate: info.pubDate,
                downloadUrl: info.downloadUrl,
            });
        } catch (err: unknown) {
            setState({
                status: "error",
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    async function handleInstall(downloadUrl: string) {
        // Set initial state; percent will be driven by "updater:progress" events from Go
        setState({ status: "downloading", percent: 0 });
        try {
            await UpdateService.DownloadAndInstall(downloadUrl);
        } catch (err: unknown) {
            setState({
                status: "error",
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    function reset() {
        setState({ status: "idle" });
    }

    const isChecking = state.status === "checking";
    const isDownloading = state.status === "downloading";
    const busy = isChecking || isDownloading;

    return (
        <div className="flex flex-col gap-2 rounded border border-border px-4 py-2">
            {/* Header row */}
            <div className="group flex items-center gap-4">
                <span className="text-xs font-medium tracking-widest text-nowrap text-muted-foreground/50 uppercase select-none">
                    Check for updates
                </span>
                <Separator orientation="vertical" className="my-2" />
                <div className="ml-auto flex items-center gap-2">
                    {(state.status === "idle" ||
                        state.status === "upToDate" ||
                        state.status === "error") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            className={cn(
                                "pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
                            )}
                            onClick={handleCheck}
                        >
                            {isChecking ? "Checking…" : "Check for updates"}
                        </Button>
                    )}

                    {state.status === "available" && (
                        <>
                            <span className="text-xs text-muted-foreground">
                                v{state.newVersion} available
                            </span>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleInstall(state.downloadUrl)}
                            >
                                Download &amp; Install
                            </Button>
                            <Button variant="ghost" size="sm" onClick={reset}>
                                Later
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Status rows */}
            {state.status === "checking" && (
                <p className="animate-pulse text-xs text-muted-foreground">
                    Checking for updates…
                </p>
            )}

            {state.status === "upToDate" && (
                <p className="text-xs text-muted-foreground">
                    You're on the latest version.
                </p>
            )}

            {state.status === "available" && state.notes && (
                <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                    {state.notes}
                </p>
            )}

            {state.status === "downloading" && (
                <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-200"
                            style={{ width: `${state.percent}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Downloading… {state.percent}%
                    </p>
                </div>
            )}

            {state.status === "error" && (
                <p className="text-xs text-destructive">{state.message}</p>
            )}
        </div>
    );
}
