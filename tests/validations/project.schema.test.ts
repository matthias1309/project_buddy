import { describe, it, expect } from "vitest";
import { CreateProjectSchema } from "@/lib/validations/project.schema";

const valid = {
  name: "Alpha Project",
  project_number: "PRJ-001",
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  total_budget_eur: 100000,
};

describe("CreateProjectSchema — required fields", () => {
  it("accepts a fully valid payload", () => {
    expect(CreateProjectSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name: _, ...rest } = valid;
    expect(CreateProjectSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(
      CreateProjectSchema.safeParse({ ...valid, name: "" }).success
    ).toBe(false);
  });

  it("rejects missing project_number", () => {
    const { project_number: _, ...rest } = valid;
    expect(CreateProjectSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty project_number", () => {
    expect(
      CreateProjectSchema.safeParse({ ...valid, project_number: "" }).success
    ).toBe(false);
  });

  it("rejects missing start_date", () => {
    const { start_date: _, ...rest } = valid;
    expect(CreateProjectSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing end_date", () => {
    const { end_date: _, ...rest } = valid;
    expect(CreateProjectSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid date format for start_date", () => {
    expect(
      CreateProjectSchema.safeParse({ ...valid, start_date: "01-01-2024" }).success
    ).toBe(false);
  });

  it("rejects missing total_budget_eur", () => {
    const { total_budget_eur: _, ...rest } = valid;
    expect(CreateProjectSchema.safeParse(rest).success).toBe(false);
  });
});

describe("CreateProjectSchema — budget validation", () => {
  it("rejects zero budget", () => {
    expect(
      CreateProjectSchema.safeParse({ ...valid, total_budget_eur: 0 }).success
    ).toBe(false);
  });

  it("rejects negative budget", () => {
    expect(
      CreateProjectSchema.safeParse({ ...valid, total_budget_eur: -500 }).success
    ).toBe(false);
  });

  it("coerces a numeric string to a number", () => {
    const result = CreateProjectSchema.safeParse({
      ...valid,
      total_budget_eur: "75000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_budget_eur).toBe(75000);
    }
  });
});

describe("CreateProjectSchema — date range refinement", () => {
  it("rejects end_date before start_date", () => {
    const result = CreateProjectSchema.safeParse({
      ...valid,
      start_date: "2024-06-01",
      end_date: "2024-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("end_date");
    }
  });

  it("accepts end_date equal to start_date", () => {
    expect(
      CreateProjectSchema.safeParse({
        ...valid,
        start_date: "2024-06-01",
        end_date: "2024-06-01",
      }).success
    ).toBe(true);
  });

  it("accepts end_date after start_date", () => {
    expect(
      CreateProjectSchema.safeParse({
        ...valid,
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      }).success
    ).toBe(true);
  });
});

describe("CreateProjectSchema — optional fields", () => {
  it("accepts a payload without description and client", () => {
    expect(CreateProjectSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts description and client when provided", () => {
    const result = CreateProjectSchema.safeParse({
      ...valid,
      description: "Internal tooling project",
      client: "Acme Corp",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Internal tooling project");
      expect(result.data.client).toBe("Acme Corp");
    }
  });
});
