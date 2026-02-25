import z from "zod";

export const printSchema = z.object({
    name: z.string().min(1, "Name is required").max(300),
    status: z.string().min(1).max(50),
    notes: z.string().max(2000),
    datePrinted: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date",
    }),
    spools: z
        .array(
            z.object({
                spoolId: z.number().int().nonnegative(),
                spoolCode: z.string().min(1, "Please select a spool"),
                color: z.string(),
                colorHex: z.string(),
                vendor: z.string(),
                material: z.string(),
                gramsUsed: z
                    .number()
                    .min(1, "How many grams did this print use?")
                    .max(10000),
            })
        )
        .min(1, "At least one spool is required"),
});

export type TPrintSchema = z.infer<typeof printSchema>;
