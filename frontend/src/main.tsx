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
    useRouteError,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { Toaster } from "@/shadcn/sonner";

import { AppEventHandler, RouteTracker } from "@/components/AppEventHandler";
import { CopyToClipboard } from "@/components/CopyToClipboard";
import { Navbar } from "@/components/Navbar";
import { PrintsPage } from "@/components/Prints";
import { SpoolsPage } from "@/components/Spools";

import { getThemeScript } from "@/lib/util-theme";

import "./index.css";

const ViewerPage = lazy(() => import("./components/Viewer"));

// === Pre-hydration theme injection ===
if (typeof document !== "undefined") {
    const script = document.createElement("script");
    script.innerHTML = getThemeScript;
    document.head.appendChild(script);
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // Data is fresh for 1 minute
            gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
            retry: 1, // Retry failed requests once
            refetchOnWindowFocus: false, // Don't refetch on window focus (good for desktop app)
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
                element: <Navigate to="/prints" replace />,
                // element: <Navigate to="/viewer?modelPath=1.3mf" replace />,
            },
            { path: "/spools", element: <SpoolsPage /> },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = useRouteError() as any;

    const errorMessage = error.status
        ? `${error.status} ${error.statusText}`
        : error.message;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
                Something went wrong
            </h1>

            <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
                The page you tried to open could not be loaded.
            </p>

            {error && (
                <pre className="group relative mt-4 w-full max-w-xl overflow-auto rounded bg-gray-100 p-3 text-left text-sm whitespace-pre-wrap text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                    <div className="absolute top-2 right-2">
                        <CopyToClipboard
                            textToCopy={errorMessage}
                            tooltipContent="Copy Error Message"
                        />
                    </div>
                    {errorMessage}
                </pre>
            )}

            <div className="flex gap-4">
                <Link
                    to="/spools"
                    className="mt-6 text-sm font-medium underline underline-offset-4"
                >
                    Go to Spools
                </Link>

                <Link
                    to="/prints"
                    className="mt-6 text-sm font-medium underline underline-offset-4"
                >
                    Go to Prints
                </Link>
            </div>
        </div>
    );
}
