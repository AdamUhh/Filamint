import * as z from "zod/mini";

import { formatGrams } from "@/lib/util-format";

const modelSchema = z.union([
    z.custom<File>(), // for new uploads
    z.object({
        // for existing models
        id: z.number(),
        name: z.string(),
        ext: z.string(),
        size: z.number(),
        data: z.string(),
    }),
]);

export const printSchema = z.object({
    name: z
        .string()
        .check(z.minLength(1, "Name is required"), z.maxLength(300)),
    status: z.string().check(z.minLength(1), z.maxLength(50)),
    notes: z.string().check(z.maxLength(2000)),
    datePrinted: z.string().check(
        z.refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date",
        })
    ),
    models: z.array(modelSchema),
    spools: z
        .array(
            z.object({
                spoolId: z.number().check(z.int(), z.gte(0)),
                spoolCode: z
                    .string()
                    .check(z.minLength(1, "Please select a spool")),
                color: z.string(),
                colorHex: z.string(),
                vendor: z.string(),
                material: z.string(),
                totalWeight: z.number(),
                usedWeight: z.number(),
                gramsUsed: z
                    .number()
                    .check(
                        z.gte(1, "How many grams did this print use?"),
                        z.lte(10000)
                    ),
                originalGramsUsed: z.optional(z.number()),
            })
        )
        .check(
            z.minLength(1, "At least one spool is required"),
            z.superRefine((spools, ctx) => {
                spools.forEach((spool, index) => {
                    const original = spool.originalGramsUsed ?? 0;
                    const remaining = formatGrams(
                        spool.totalWeight - spool.usedWeight + original
                    );
                    if (spool.gramsUsed > remaining) {
                        ctx.addIssue({
                            code: "custom",
                            path: [index, "gramsUsed"],
                            message: `Grams used (${spool.gramsUsed}) exceeds remaining weight (${remaining}).`,
                        });
                    }
                });
            })
        ),
});

export type TPrintSchema = z.infer<typeof printSchema>;
export type TModelSchema = z.infer<typeof modelSchema>;
