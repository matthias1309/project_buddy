import { z } from "zod";
import { ERRORS } from "@/lib/errors";

export const SprintSchema = z
  .object({
    name:       z.string().trim().min(1, ERRORS.SPRINT_NAME_REQUIRED),
    start_date: z.string().date(),
    end_date:   z.string().date(),
  })
  .refine((d) => d.end_date > d.start_date, {
    message: ERRORS.SPRINT_END_AFTER_START,
    path: ["end_date"],
  });

export type SprintInput = z.infer<typeof SprintSchema>;
