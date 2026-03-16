import type { Print } from "@bindings/services";

export type EditState = {
    isOpen: boolean;
    id: number;
    original: Print | null;
};
