import type { TPrintSchema } from "@/components/Prints/lib/schema";

export const PAGE_SIZE = 15;

export const defaultPrintValues: TPrintSchema = {
    name: "",
    status: "completed",
    notes: "",
    datePrinted: new Date().toISOString(),
    spools: [
        {
            gramsUsed: 0,
            spool: {
                id: 0,
                spoolCode: "",
                color: "#000000",
                material: "PLA",
                vendor: "Bambu Labs",
            },
        },
    ],
};
