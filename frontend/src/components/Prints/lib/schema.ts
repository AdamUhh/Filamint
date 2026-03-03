import z from "zod";

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
    name: z.string().min(1, "Name is required").max(300),
    status: z.string().min(1).max(50),
    notes: z.string().max(2000),
    datePrinted: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date",
    }),
    models: z.array(modelSchema),
    spools: z
        .array(
            z.object({
                spoolId: z.number().int().nonnegative(),
                spoolCode: z.string().min(1, "Please select a spool"),
                color: z.string(),
                colorHex: z.string(),
                vendor: z.string(),
                material: z.string(),
                totalWeight: z.number(),
                usedWeight: z.number(),
                gramsUsed: z
                    .number()
                    .min(1, "How many grams did this print use?")
                    .max(10000),
            })
        )
        .min(1, "At least one spool is required")
        .superRefine((spools, ctx) => {
            spools.forEach((spool, index) => {
                const remaining = spool.totalWeight - spool.usedWeight;

                if (spool.gramsUsed > remaining) {
                    ctx.addIssue({
                        code: "custom",
                        path: [index, "gramsUsed"],
                        message: `Grams used (${spool.gramsUsed}) exceeds remaining weight (${remaining}).`,
                    });
                }
            });
        }),
});

export type TPrintSchema = z.infer<typeof printSchema>;
export type TModelSchema = z.infer<typeof modelSchema>;
