import type { TSpoolSchema } from "@/components/Spools/lib/schema";

export const PAGE_SIZE = 15;

export const defaultSpoolValues: TSpoolSchema = {
    vendor: "",
    material: "",
    materialType: "",
    color: "",
    colorHex: "#000000",
    totalWeight: 0,
    usedWeight: 0,
    cost: 0,
    referenceLink: "",
    notes: "",
    isTemplate: false,
};
