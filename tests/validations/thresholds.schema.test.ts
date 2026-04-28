import { describe, it, expect } from "vitest";
import { ThresholdsSchema, DEFAULT_THRESHOLDS } from "@/lib/validations/thresholds.schema";
import { ERRORS } from "@/lib/errors";

const validInput = {
  budget_yellow_pct: "15",
  budget_red_pct: "25",
  schedule_yellow_days: "5",
  schedule_red_days: "15",
  resource_yellow_pct: "85",
  resource_red_pct: "100",
  scope_yellow_pct: "10",
  scope_red_pct: "20",
  epic_warning_margin_pct: "10",
  quality_lead_critical_days: "5",
  quality_lead_major_days: "10",
  quality_lead_minor_days: "20",
  quality_lead_trivial_days: "50",
};

describe("ThresholdsSchema", () => {
  describe("valid input", () => {
    it("should parse string numbers (form coercion)", () => {
      const result = ThresholdsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.budget_yellow_pct).toBe(15);
        expect(result.data.schedule_red_days).toBe(15);
      }
    });

    it("should accept numeric values directly", () => {
      const result = ThresholdsSchema.safeParse(DEFAULT_THRESHOLDS);
      expect(result.success).toBe(true);
    });

    it("should accept resource_red_pct = 100 (edge: utilisation cap)", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        resource_yellow_pct: "85",
        resource_red_pct: "100",
      });
      expect(result.success).toBe(true);
    });

    it("should accept custom high pct values (e.g. 150%)", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        resource_yellow_pct: "120",
        resource_red_pct: "150",
      });
      expect(result.success).toBe(true);
    });

    it("should coerce integer-like floats for days fields", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        schedule_yellow_days: "5",
        schedule_red_days: "15",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schedule_yellow_days).toBe(5);
      }
    });
  });

  describe("red > yellow refinements", () => {
    it("should fail when budget_red_pct <= budget_yellow_pct", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        budget_yellow_pct: "25",
        budget_red_pct: "25",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const budgetError = result.error.issues.find(
          (i) => i.path[0] === "budget_red_pct",
        );
        expect(budgetError?.message).toBe(ERRORS.THRESHOLD_INVALID_RANGE);
      }
    });

    it("should fail when budget_red_pct < budget_yellow_pct", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        budget_yellow_pct: "30",
        budget_red_pct: "20",
      });
      expect(result.success).toBe(false);
    });

    it("should fail when schedule_red_days <= schedule_yellow_days", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        schedule_yellow_days: "10",
        schedule_red_days: "10",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find(
          (i) => i.path[0] === "schedule_red_days",
        );
        expect(err?.message).toBe(ERRORS.THRESHOLD_INVALID_RANGE);
      }
    });

    it("should fail when resource_red_pct <= resource_yellow_pct", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        resource_yellow_pct: "100",
        resource_red_pct: "85",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find(
          (i) => i.path[0] === "resource_red_pct",
        );
        expect(err?.message).toBe(ERRORS.THRESHOLD_INVALID_RANGE);
      }
    });

    it("should fail when scope_red_pct <= scope_yellow_pct", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        scope_yellow_pct: "20",
        scope_red_pct: "10",
      });
      expect(result.success).toBe(false);
    });

    it("should report errors on all four dimensions simultaneously", () => {
      const result = ThresholdsSchema.safeParse({
        budget_yellow_pct: "30",
        budget_red_pct: "10",
        schedule_yellow_days: "15",
        schedule_red_days: "5",
        resource_yellow_pct: "100",
        resource_red_pct: "80",
        scope_yellow_pct: "20",
        scope_red_pct: "5",
        epic_warning_margin_pct: "10",
        quality_lead_critical_days: "5",
        quality_lead_major_days: "10",
        quality_lead_minor_days: "20",
        quality_lead_trivial_days: "50",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("budget_red_pct");
        expect(paths).toContain("schedule_red_days");
        expect(paths).toContain("resource_red_pct");
        expect(paths).toContain("scope_red_pct");
      }
    });
  });

  describe("field-level validation", () => {
    it("should reject negative pct values", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        budget_yellow_pct: "-5",
        budget_red_pct: "-1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject pct values above 200", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        budget_yellow_pct: "150",
        budget_red_pct: "250",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer days values", () => {
      const result = ThresholdsSchema.safeParse({
        ...validInput,
        schedule_yellow_days: "3.5",
        schedule_red_days: "10.5",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing fields", () => {
      const result = ThresholdsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("epic_warning_margin_pct", () => {
    it("should accept valid margin values", () => {
      const result = ThresholdsSchema.safeParse({ ...validInput, epic_warning_margin_pct: "15" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.epic_warning_margin_pct).toBe(15);
    });

    it("should reject value below minimum (0)", () => {
      const result = ThresholdsSchema.safeParse({ ...validInput, epic_warning_margin_pct: "0" });
      expect(result.success).toBe(false);
    });

    it("should reject value above maximum (100)", () => {
      const result = ThresholdsSchema.safeParse({ ...validInput, epic_warning_margin_pct: "100" });
      expect(result.success).toBe(false);
    });

    it("should accept boundary values 1 and 99", () => {
      expect(ThresholdsSchema.safeParse({ ...validInput, epic_warning_margin_pct: "1" }).success).toBe(true);
      expect(ThresholdsSchema.safeParse({ ...validInput, epic_warning_margin_pct: "99" }).success).toBe(true);
    });
  });

  describe("DEFAULT_THRESHOLDS", () => {
    it("should be a valid ThresholdsInput", () => {
      const result = ThresholdsSchema.safeParse(DEFAULT_THRESHOLDS);
      expect(result.success).toBe(true);
    });

    it("should have expected default values", () => {
      expect(DEFAULT_THRESHOLDS.budget_yellow_pct).toBe(15);
      expect(DEFAULT_THRESHOLDS.budget_red_pct).toBe(25);
      expect(DEFAULT_THRESHOLDS.schedule_yellow_days).toBe(5);
      expect(DEFAULT_THRESHOLDS.schedule_red_days).toBe(15);
      expect(DEFAULT_THRESHOLDS.resource_yellow_pct).toBe(85);
      expect(DEFAULT_THRESHOLDS.resource_red_pct).toBe(100);
      expect(DEFAULT_THRESHOLDS.scope_yellow_pct).toBe(10);
      expect(DEFAULT_THRESHOLDS.scope_red_pct).toBe(20);
      expect(DEFAULT_THRESHOLDS.epic_warning_margin_pct).toBe(10);
    });
  });
});
