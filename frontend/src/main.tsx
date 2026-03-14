import { AppProvider } from "@/context/appContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
    Link,
    Navigate,
    Outlet,
    createHashRouter,
    isRouteErrorResponse,
    useRouteError,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { Toaster } from "@/shadcn/sonner";

import { AppEventHandler, RouteTracker } from "@/components/AppEventHandler";
import { CopyToClipboard } from "@/components/CopyToClipboard";
import { Navbar } from "@/components/Navbar";
import { PrintsPage } from "@/components/Prints";

import { getThemeScript } from "@/lib/util-theme";

import "./index.css";

const ViewerPage = lazy(() => import("./components/Viewer"));
const SpoolsPage = lazy(() => import("./components/Spools"));

// === Pre-hydration theme injection ===
if (typeof document !== "undefined") {
    const script = document.createElement("script");
    script.innerHTML = getThemeScript;
    document.head.appendChild(script);
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 10 * 60 * 1000, // Data is fresh for 10 minute
            gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
            retry: 1, // Retry failed requests once
            refetchOnWindowFocus: false, // Don't refetch on window focus
        },
        mutations: {
            retry: 0, // Don't retry mutations
        },
    },
});

const router = createHashRouter([
    {
        element: (
            <>
                <script dangerouslySetInnerHTML={{ __html: getThemeScript }} />
                <RouteTracker />
                <AppEventHandler />
                <Toaster />
                <QueryClientProvider client={queryClient}>
                    <AppProvider>
                        <Outlet />
                        <Navbar />
                    </AppProvider>
                </QueryClientProvider>
            </>
        ),
        errorElement: <RouteError />,
        children: [
            {
                path: "/",
                element: <Navigate to="/spools" replace />,
            },
            {
                path: "/spools",
                element: (
                    <Suspense
                        fallback={
                            <div className="flex h-screen w-screen flex-col items-center justify-center gap-3">
                                <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
                                <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
                                    Loading...
                                </p>
                            </div>
                        }
                    >
                        <SpoolsPage />
                    </Suspense>
                ),
            },
            { path: "/prints", element: <PrintsPage /> },
            {
                path: "/viewer",
                element: (
                    <Suspense
                        fallback={
                            <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[#333]">
                                <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
                                <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
                                    Loading...
                                </p>
                            </div>
                        }
                    >
                        <ViewerPage />
                    </Suspense>
                ),
            },
        ],
    },
]);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);

export function RouteError() {
    const error = useRouteError();

    let errorMessage: string;
    if (isRouteErrorResponse(error)) {
        errorMessage = `${error.status} ${error.statusText}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else {
        errorMessage = String(error);
    }

    return (
        <div className="mx-auto flex h-screen max-w-xl flex-col items-center justify-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">
                Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
                The page you tried to open could not be loaded.
            </p>

            {errorMessage && (
                <pre className="group flex w-full items-center justify-between rounded bg-muted p-3 text-sm whitespace-pre-wrap">
                    {errorMessage}
                    <CopyToClipboard
                        textToCopy={errorMessage}
                        tooltipContent="Copy Error Message"
                    />
                </pre>
            )}

            <div className="flex gap-4 text-sm font-medium underline underline-offset-4">
                <Link to="/spools">Go to Spools</Link>

                <Link to="/prints">Go to Prints</Link>
            </div>
        </div>
    );
}
