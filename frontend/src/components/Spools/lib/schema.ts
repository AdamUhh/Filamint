import * as z from "zod/mini";

export const spoolSchema = z
    .object({
        vendor: z
            .string()
            .check(z.minLength(1, "Vendor is required"), z.maxLength(100)),
        material: z
            .string()
            .check(z.minLength(1, "Material is required"), z.maxLength(100)),
        materialType: z
            .string()
            .check(
                z.minLength(1, "Material type is required"),
                z.maxLength(100)
            ),
        color: z
            .string()
            .check(z.minLength(1, "Color is required"), z.maxLength(100)),
        colorHex: z
            .string()
            .check(z.regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")),
        totalWeight: z
            .number()
            .check(z.gte(0, "Must be 0 or greater"), z.lte(10000)),
        usedWeight: z
            .number()
            .check(z.gte(0, "Must be 0 or greater"), z.lte(10000)),
        cost: z
            .number()
            .check(z.gte(0, "Must be 0 or greater"), z.lte(1_000_000_000)),
        referenceLink: z.union([z.url("Invalid URL"), z.literal("")]),
        notes: z.string().check(z.maxLength(2000)),
        isTemplate: z.boolean(),
    })
    .check(
        z.refine((data) => data.usedWeight <= data.totalWeight, {
            message: "Used weight cannot be greater than total weight",
            path: ["usedWeight"],
        })
    );

export type TSpoolSchema = z.infer<typeof spoolSchema>;
