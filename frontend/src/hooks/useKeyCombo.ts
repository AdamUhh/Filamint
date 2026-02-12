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

        Events.On("window:reload_shortcuts", handler);

        return () => {
            active = false;
            Events.Off("window:reload_shortcuts");
        };
    }, [action]);

    return combo;
}
