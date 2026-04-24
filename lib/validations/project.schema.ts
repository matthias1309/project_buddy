import { z } from "zod";
import { ERRORS } from "@/lib/errors";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, ERRORS.PROJECT_INVALID_DATE);

export const CreateProjectSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    project_number: z.string().min(1, "Project number is required"),
    start_date: dateString,
    end_date: dateString,
    total_budget_eur: z.coerce.number().positive("Budget must be greater than 0"),
    description: z.string().optional(),
    client: z.string().optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
