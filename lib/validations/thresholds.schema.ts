import { z } from "zod";
import { ERRORS } from "@/lib/errors";

const pctField = z.coerce.number().min(0).max(200);
const daysField = z.coerce.number().int().min(0);
const leadDaysField = z.coerce.number().int().min(1);

export const ThresholdsSchema = z
  .object({
    budget_yellow_pct: pctField,
    budget_red_pct: pctField,
    schedule_yellow_days: daysField,
    schedule_red_days: daysField,
    resource_yellow_pct: pctField,
    resource_red_pct: pctField,
    scope_yellow_pct: pctField,
    scope_red_pct: pctField,
    epic_warning_margin_pct: z.coerce.number().min(1).max(99),
    quality_lead_critical_days: leadDaysField,
    quality_lead_major_days: leadDaysField,
    quality_lead_minor_days: leadDaysField,
    quality_lead_trivial_days: leadDaysField,
  })
  .refine((d) => d.budget_red_pct > d.budget_yellow_pct, {
    message: ERRORS.THRESHOLD_INVALID_RANGE,
    path: ["budget_red_pct"],
  })
  .refine((d) => d.schedule_red_days > d.schedule_yellow_days, {
    message: ERRORS.THRESHOLD_INVALID_RANGE,
    path: ["schedule_red_days"],
  })
  .refine((d) => d.resource_red_pct > d.resource_yellow_pct, {
    message: ERRORS.THRESHOLD_INVALID_RANGE,
    path: ["resource_red_pct"],
  })
  .refine((d) => d.scope_red_pct > d.scope_yellow_pct, {
    message: ERRORS.THRESHOLD_INVALID_RANGE,
    path: ["scope_red_pct"],
  });

export type ThresholdsInput = z.infer<typeof ThresholdsSchema>;

export const DEFAULT_THRESHOLDS: ThresholdsInput = {
  budget_yellow_pct: 15,
  budget_red_pct: 25,
  schedule_yellow_days: 5,
  schedule_red_days: 15,
  resource_yellow_pct: 85,
  resource_red_pct: 100,
  scope_yellow_pct: 10,
  scope_red_pct: 20,
  epic_warning_margin_pct: 10,
  quality_lead_critical_days: 5,
  quality_lead_major_days: 10,
  quality_lead_minor_days: 20,
  quality_lead_trivial_days: 50,
};
