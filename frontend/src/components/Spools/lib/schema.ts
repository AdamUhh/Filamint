import z from "zod";

export const spoolSchema = z
    .object({
        vendor: z.string().min(1, "Vendor is required").max(100),
        material: z.string().min(1, "Material is required").max(100),
        materialType: z.string().min(1, "Material type is required").max(100),
        color: z.string().min(1, "Color is required").max(100),
        colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
        totalWeight: z.number().min(0, "Must be 0 or greater").max(10000),
        usedWeight: z.number().min(0, "Must be 0 or greater").max(10000),
        cost: z.number().min(0, "Must be 0 or greater").max(1_000_000_000),
        referenceLink: z.url("Invalid URL").or(z.literal("")),
        notes: z.string().max(2000),
        isTemplate: z.boolean(),
    })
    .refine((data) => data.usedWeight <= data.totalWeight, {
        message: "Used weight cannot be greater than total weight",
        path: ["usedWeight"],
    });

export type TSpoolSchema = z.infer<typeof spoolSchema>;
