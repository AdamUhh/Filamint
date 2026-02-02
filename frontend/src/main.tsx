import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Link, Outlet, createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { Toaster } from "@/shadcn/sonner";

import { AppEventHandler } from "@/components/AppEventHandler";
import { PrintsPage } from "@/components/Prints";
import { SpoolsPage } from "@/components/Spools";

import "./index.css";

const router = createBrowserRouter([
    {
        element: (
            <>
                <AppEventHandler />
                <Toaster />
                <Outlet />
            </>
        ),
        children: [
            {
                path: "/",
                element: (
                    <div>
                        <Link to="/spools">Go to Spools</Link>
                    </div>
                ),
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
