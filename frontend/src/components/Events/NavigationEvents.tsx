import { Events, Window } from "@wailsio/runtime";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

export function NavigationEvents() {
    const navigate = useNavigate();
    const windowNameRef = useRef<string | null>(null);

    useEffect(() => {
        let unsubSpoolRedirect: (() => void) | undefined;
        let unsubPrintRedirect: (() => void) | undefined;

        Window.Name().then((name) => {
            // NOTE: Its not actually the name, its 'window-1', 'window-2', etc
            windowNameRef.current = name;

            unsubSpoolRedirect = Events.On("spool:redirect", (event) => {
                if (event.data !== windowNameRef.current) return;
                navigate("/spools");
            });
            unsubPrintRedirect = Events.On("print:redirect", (event) => {
                if (event.data !== windowNameRef.current) return;
                navigate("/prints");
            });
        });

        return () => {
            unsubSpoolRedirect?.();
            unsubPrintRedirect?.();
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
