import { Events, Window } from "@wailsio/runtime";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { UpdateService } from "@bindings/updater";

export function AppEventHandler() {
    const navigate = useNavigate();
    const windowNameRef = useRef<string | null>(null);

    useEffect(() => {
        Window.Name().then((name) => {
            // NOTE: Its not actually the name, its 'window-1', 'window-2', etc
            windowNameRef.current = name;
        });
    }, []);

    useEffect(() => {
        const unsubSpoolRedirect = Events.On("spool:redirect", (event) => {
            if (event.data !== windowNameRef.current) return;
            navigate("/spools");
        });

        const unsubPrintRedirect = Events.On("print:redirect", (event) => {
            if (event.data !== windowNameRef.current) return;
            navigate("/prints");
        });

        return () => {
            unsubSpoolRedirect();
            unsubPrintRedirect();
        };
    }, [navigate]);

    return null;
}

export function RouteTracker() {
    const location = useLocation();

    useEffect(() => {
        Events.Emit("route:changed", location.pathname);
    }, [location.pathname]);

    return null;
}
