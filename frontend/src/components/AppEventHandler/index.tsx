import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function AppEventHandler() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleSpoolRedirect = () => {
            navigate("/spools");
        };
        const unsubSpoolRedirect = Events.On(
            "spool:redirect",
            handleSpoolRedirect
        );

        const handlePrintRedirect = () => {
            navigate("/prints");
        };
        const unsubPrintRedirect = Events.On(
            "print:redirect",
            handlePrintRedirect
        );

        return () => {
            unsubSpoolRedirect();
            unsubPrintRedirect();
        };
    }, [navigate]);

    return null;
}
