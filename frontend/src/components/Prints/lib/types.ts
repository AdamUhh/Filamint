import type { Print } from "@bindings";

export type EditState = {
    isOpen: boolean;
    id: number;
    original: Print | null;
};
