import { ShortcutService } from "@bindings/index.ts";
import { Events } from "@wailsio/runtime";
import { useEffect, useMemo, useState } from "react";

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

export function useKeyCombos(_actions: string[]) {
    const [combos, setCombos] = useState<string[]>([]);
    const [actions] = useState(_actions);

    const actionsKey = useMemo(
        () => actions.slice().sort().join(","),
        [actions]
    );

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const result = await ShortcutService.GetShortcutCombos(actions);
            if (!cancelled) setCombos(result ?? []);
        };

        load();

        const unsubscribe = Events.On("window:reload_shortcuts", load);

        return () => {
            cancelled = true;
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionsKey]);

    return combos;
}
