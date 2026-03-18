import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";

import { Button } from "@/shadcn/button";

import { tryParseJson } from "@/lib/util-format";
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
    | { status: "readyToRestart" }
    | { status: "error"; message: string };

interface DownloadProgress {
    bytesDownloaded: number;
    totalBytes: number;
    percent: number;
}

export function UpdateSettings() {
    const [state, setState] = useState<UpdateState>({ status: "idle" });
    const [version, setVersion] = useState("");

    useEffect(() => {
        const offProgress = Events.On("updater:progress", (event) => {
            const p = event.data as DownloadProgress;
            setState(
                p.percent >= 100
                    ? { status: "readyToRestart" }
                    : { status: "downloading", percent: Math.round(p.percent) }
            );
        });

        const offRestart = Events.On("updater:restart", () => {
            setState({ status: "readyToRestart" });
        });

        return () => {
            offProgress();
            offRestart();
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        UpdateService.GetVersion().then((v) => {
            if (mounted) setVersion(v);
        });
        return () => {
            mounted = false;
        };
    }, []);

    async function handleCheck() {
        setState({ status: "checking" });
        try {
            const info = await UpdateService.CheckForUpdate();
            if (!info?.available) {
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
        setState({ status: "downloading", percent: 0 });
        try {
            await UpdateService.DownloadAndInstall(downloadUrl);
        } catch (err: unknown) {
            setState({
                status: "error",
                message:
                    err instanceof Error
                        ? (tryParseJson(err.message)?.message ?? err.message)
                        : "Download failed.",
            });
        }
    }

    function reset() {
        setState({ status: "idle" });
    }

    const isChecking = state.status === "checking";
    const isDownloading = state.status === "downloading";
    const busy = isChecking || isDownloading;
    const isError = state.status === "error";

    const showCheckButton =
        state.status === "idle" || state.status === "upToDate" || isError;

    const hasDetailPanel =
        isChecking || isDownloading || state.status === "available" || isError;

    return (
        <div
            className={cn(
                "flex flex-col gap-0 overflow-hidden rounded-lg border bg-card",
                isError ? "border-destructive/50" : "border-border"
            )}
        >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
                {version && (
                    <span className="text-sm text-muted-foreground">
                        App Version: v{version}
                    </span>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {state.status === "upToDate" && (
                        <span className="text-xs text-muted-foreground/50">
                            Up to date
                        </span>
                    )}

                    {state.status === "available" && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                            v{state.newVersion} available
                        </span>
                    )}

                    {state.status === "downloading" && (
                        <>
                            <span className="text-xs text-muted-foreground/50">
                                Downloading...
                            </span>
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                {state.percent}%
                            </span>
                        </>
                    )}

                    {showCheckButton && (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={handleCheck}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {isChecking
                                ? "Checking..."
                                : isError
                                  ? "Try again"
                                  : "Check for updates"}
                        </Button>
                    )}

                    {state.status === "available" && (
                        <>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleInstall(state.downloadUrl)}
                                className="h-7 px-3 text-xs"
                            >
                                Update
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={reset}
                                className="h-7 px-3 text-xs text-muted-foreground"
                            >
                                Later
                            </Button>
                        </>
                    )}

                    {state.status === "readyToRestart" && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={UpdateService.RestartApp}
                            className="h-7 px-3 text-xs"
                        >
                            Restart to update
                        </Button>
                    )}
                </div>
            </div>

            {/* Detail panel */}
            {hasDetailPanel && (
                <div
                    className={cn(
                        "flex flex-col gap-3 border-t px-4 py-3",
                        isError
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-border/50"
                    )}
                >
                    {isChecking && (
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="size-1 animate-pulse rounded-full bg-muted-foreground/40"
                                        style={{
                                            animationDelay: `${i * 150}ms`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span className="text-xs text-muted-foreground/50">
                                Checking for updates...
                            </span>
                        </div>
                    )}

                    {state.status === "available" && state.notes && (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground/70">
                            {state.notes}
                        </p>
                    )}

                    {isDownloading && (
                        <div className="flex flex-col gap-2">
                            <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-foreground/70 transition-all duration-300 ease-out"
                                    style={{ width: `${state.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {isError && (
                        <p className="text-xs text-destructive/80">
                            {state.message}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
