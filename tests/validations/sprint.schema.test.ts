import { describe, it, expect } from "vitest";
import { SprintSchema } from "@/lib/validations/sprint.schema";
import { ERRORS } from "@/lib/errors";

const valid = {
  name:       "CPI26.2.1 CW13/14 Oolong",
  start_date: "2026-03-30",
  end_date:   "2026-04-11",
};

describe("SprintSchema", () => {
  describe("valid input", () => {
    it("should accept a well-formed sprint", () => {
      expect(SprintSchema.safeParse(valid).success).toBe(true);
    });

    it("should trim whitespace from name", () => {
      const result = SprintSchema.safeParse({ ...valid, name: "  Sprint 1  " });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.name).toBe("Sprint 1");
    });

    it("should accept a single-day sprint where end is one day after start", () => {
      const result = SprintSchema.safeParse({
        ...valid,
        start_date: "2026-04-01",
        end_date:   "2026-04-02",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("name validation", () => {
    it("should reject an empty name", () => {
      const result = SprintSchema.safeParse({ ...valid, name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path[0] === "name");
        expect(err?.message).toBe(ERRORS.SPRINT_NAME_REQUIRED);
      }
    });

    it("should reject a whitespace-only name", () => {
      const result = SprintSchema.safeParse({ ...valid, name: "   " });
      expect(result.success).toBe(false);
    });
  });

  describe("date validation", () => {
    it("should reject an invalid start_date format", () => {
      const result = SprintSchema.safeParse({ ...valid, start_date: "30-03-2026" });
      expect(result.success).toBe(false);
    });

    it("should reject an invalid end_date format", () => {
      const result = SprintSchema.safeParse({ ...valid, end_date: "not-a-date" });
      expect(result.success).toBe(false);
    });
  });

  describe("end_date > start_date refinement", () => {
    it("should reject end_date equal to start_date", () => {
      const result = SprintSchema.safeParse({
        ...valid,
        start_date: "2026-04-01",
        end_date:   "2026-04-01",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path[0] === "end_date");
        expect(err?.message).toBe(ERRORS.SPRINT_END_AFTER_START);
      }
    });

    it("should reject end_date before start_date", () => {
      const result = SprintSchema.safeParse({
        ...valid,
        start_date: "2026-04-10",
        end_date:   "2026-04-01",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const err = result.error.issues.find((i) => i.path[0] === "end_date");
        expect(err?.message).toBe(ERRORS.SPRINT_END_AFTER_START);
      }
    });
  });
});
