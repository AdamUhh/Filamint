import type { Spool } from "@bindings/services";

export type EditState = {
    isOpen: boolean;
    id: number;
    original: Spool | null;
};
