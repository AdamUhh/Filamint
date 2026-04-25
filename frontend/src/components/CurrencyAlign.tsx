import { useApp } from "@/context/useContext";
import type { ReactNode } from "react";

export function CurrencyAlign({ children }: { children: ReactNode }) {
    const { options } = useApp();

    return options.currencyAlign === "left" ? (
        <>
            {options.currency} {children}
        </>
    ) : (
        <>
            {children} {options.currency}
        </>
    );
}
