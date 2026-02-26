import type { Spool } from "@bindings";

export type EditState = {
    isOpen: boolean;
    id: number;
    original: Spool | null;
};
