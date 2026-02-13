import { Events } from "@wailsio/runtime";
import { useEffect, useState } from "react";

import { ShortcutService } from "@bindings";

export function useKeyCombo(action: string) {
    const [combo, setCombo] = useState<string>("");

    useEffect(() => {
        let active = true;

        const load = async () => {
            const result = await ShortcutService.GetShortcutCombo(action);
            if (active) setCombo(result ?? "");
        };

        load();

        const handler = () => {
            load();
        };

        const unsubscribe = Events.On("window:reload_shortcuts", handler);

        return () => {
            active = false;
            unsubscribe();
        };
    }, [action]);

    return combo;
}

export function useKeyCombos(actions: string[]) {
    const [combos, setCombos] = useState<string[]>([]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            const result = await ShortcutService.GetShortcutCombos(actions);
            if (active) setCombos(result ?? []);
        };

        load();

        const handler = () => {
            load();
        };

        const unsubscribe = Events.On("window:reload_shortcuts", handler);

        return () => {
            active = false;
            unsubscribe();
        };
    }, [actions]);

    return combos;
}
