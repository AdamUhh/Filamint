import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
    AppContext,
    type AppContextValue,
    type AppOptions,
} from "./useContext";

export function AppProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<AppOptions>(() => {
        try {
            const saved = localStorage.getItem("app-options");
            if (saved) {
                return JSON.parse(saved) as AppOptions;
            }
        } catch (err) {
            console.error("Failed to parse saved options:", err);
        }

        return {
            currency: "AED",
            currencyAlign: "left",
            vendors: [
                "Bambu Lab",
                "Prusa Research",
                "Creality",
                "Elegoo",
                "Anycubic",
                "FlashForge",
                "UltiMaker",
                "Raise3D",
                "Formlabs",
                "MakerBot",
                "Zortrax",
                "QIDI Tech",
                "Artillery",
                "Snapmaker",
                "Mingda",
                "Tronxy",
                "Tevo",
                "BIQU",
                "Fokoos",
                "AnkerMake",
                "Anycubic Kobra",
                "Phrozen",
                "Peopoly",
                "EPAX",
                "Rat Rig",
                "Voron Design",
                "LulzBot",
                "Robo 3D",
                "LulzBot TAZ",
                "Geeetech",
                "Modix",
                "INTAMSYS",
                "Tiertime (UP)",
                "Dremel 3D",
                "XYZprinting",
                "WASP",
                "Markforged",
                "Stratasys",
                "3D Systems",
                "UnionTech",
            ],
        };
    });

    // Save options to localStorage whenever they change
    useEffect(() => {
        console.log("saving", JSON.stringify(options));
        localStorage.setItem("app-options", JSON.stringify(options));
    }, [options]);

    const value = useMemo<AppContextValue>(
        () => ({
            options,
            setOptions,
        }),
        [options]
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
