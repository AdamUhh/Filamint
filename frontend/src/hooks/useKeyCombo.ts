import { ShortcutService } from "@bindings";

export function useKeyCombo(action: string) {
    const result = ShortcutService.GetShortcutCombo(action);
    return result;
}

export function useKeyCombos(actions: string[]) {
    const result = ShortcutService.GetShortcutCombos(actions);
    return result;
}
