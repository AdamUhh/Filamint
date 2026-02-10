import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
    Link,
    Navigate,
    Outlet,
    createBrowserRouter,
    useRouteError,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { Toaster } from "@/shadcn/sonner";

import { AppEventHandler } from "@/components/AppEventHandler";
import { PrintsPage } from "@/components/Prints";
import { SpoolsPage } from "@/components/Spools";

import { AppProvider } from "./context/appContext";
import "./index.css";

const router = createBrowserRouter([
    {
        element: (
            <>
                <AppEventHandler />
                <Toaster />
                <AppProvider>
                    <Outlet />
                </AppProvider>
            </>
        ),
        errorElement: <RouteError />,
        children: [
            {
                path: "/",
                element: <Navigate to="/prints" replace />,
            },
            { path: "/spools", element: <SpoolsPage /> },
            { path: "/prints", element: <PrintsPage /> },
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

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
                Something went wrong
            </h1>

            <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
                The page you tried to open could not be loaded.
            </p>

            {error && (
                <pre className="mt-4 w-full max-w-xl overflow-auto rounded bg-gray-100 p-3 text-left text-sm whitespace-pre-wrap text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                    Error:{" "}
                    {error.status
                        ? `${error.status} ${error.statusText}`
                        : error.message}
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
