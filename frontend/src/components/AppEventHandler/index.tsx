import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function AppEventHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCreateSpool = () => {
            navigate("/spools", { state: { openCreateDialog: true } });
        };
        Events.On("spool:redirect_create", handleCreateSpool);

        const handleSpoolRedirect = () => {
            navigate("/spools");
        };
        Events.On("spool:redirect", handleSpoolRedirect);

        const handlePrintRedirect = () => {
            navigate("/prints");
        };
        Events.On("print:redirect", handlePrintRedirect);

        return () => {
            Events.Off("spool:redirect_create");
            Events.Off("spool:redirect");
            Events.Off("print:redirect");
        };
    }, [navigate]);

    return null; // no UI
}
