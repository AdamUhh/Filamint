import { createContext, useContext } from "react";

export interface AppOptions {
    currency: string;
    currencyAlign: "left" | "right";
    vendors: string[];
    materials: string[];
    materialTypes: string[];
    colors: string[];
    openInApp: Record<string, string>[];
    platform?: "windows" | "darwin" | "linux";
}

export interface AppContextValue {
    options: AppOptions;
    setOptions: React.Dispatch<React.SetStateAction<AppOptions>>;
    settingsOpen: boolean;
    setSettingsOpen: (bool: boolean) => void;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export function useApp(): AppContextValue {
    const ctx = useContext(AppContext);
    if (!ctx) {
        throw new Error("useApp must be used inside an OptionsProvider");
    }
    return ctx;
}
