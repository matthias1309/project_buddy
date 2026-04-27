import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const { createSprint, updateSprint, deleteSprint } =
  await import("@/lib/actions/sprint.actions");

// --- Helpers ---

const PROJECT_ID = "project-1";
const SPRINT_ID  = "sprint-1";
const USER_ID    = "user-1";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = { get: (k: string) => fields[k] ?? null } as unknown as FormData;
  return fd;
}

const validFields = {
  name:       "CPI26.2.1 CW13/14 Oolong",
  start_date: "2026-03-30",
  end_date:   "2026-04-11",
};

function setupAuth(userId: string | null = USER_ID) {
  mockGetUser.mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
}

function setupProjectAccess(found = true) {
  const single = vi.fn().mockResolvedValue({ data: found ? { id: PROJECT_ID } : null });
  const eq2    = vi.fn(() => ({ single }));
  const eq1    = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  mockFrom.mockReturnValueOnce({ select });
}

// --- createSprint ---

describe("createSprint", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return validation errors when name is empty", async () => {
    const result = await createSprint(
      PROJECT_ID,
      null,
      makeFormData({ ...validFields, name: "" }),
    );
    expect(result?.errors?.name).toBeDefined();
  });

  it("should return validation error when end_date <= start_date", async () => {
    const result = await createSprint(
      PROJECT_ID,
      null,
      makeFormData({ ...validFields, start_date: "2026-04-11", end_date: "2026-04-11" }),
    );
    expect(result?.errors?.end_date).toBeDefined();
  });

  it("should return AUTH_UNAUTHORIZED when user is not logged in", async () => {
    setupAuth(null);
    const result = await createSprint(PROJECT_ID, null, makeFormData(validFields));
    expect(result?.globalError).toMatch(/authoris/i);
  });

  it("should return PROJECT_ACCESS_DENIED when project does not belong to user", async () => {
    setupAuth();
    setupProjectAccess(false);
    const result = await createSprint(PROJECT_ID, null, makeFormData(validFields));
    expect(result?.globalError).toMatch(/access/i);
  });

  it("should return success on happy path", async () => {
    setupAuth();
    setupProjectAccess();
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ insert });

    const result = await createSprint(PROJECT_ID, null, makeFormData(validFields));
    expect(result?.success).toBe(true);
  });

  it("should return GENERIC error when DB insert fails", async () => {
    setupAuth();
    setupProjectAccess();
    const insert = vi.fn().mockResolvedValue({ error: new Error("db error") });
    mockFrom.mockReturnValueOnce({ insert });

    const result = await createSprint(PROJECT_ID, null, makeFormData(validFields));
    expect(result?.globalError).toBeDefined();
    expect(result?.success).toBeUndefined();
  });
});

// --- updateSprint ---

describe("updateSprint", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return validation errors for invalid input", async () => {
    const result = await updateSprint(
      PROJECT_ID,
      SPRINT_ID,
      null,
      makeFormData({ ...validFields, end_date: "2026-03-01" }),
    );
    expect(result?.errors?.end_date).toBeDefined();
  });

  it("should return AUTH_UNAUTHORIZED when not logged in", async () => {
    setupAuth(null);
    const result = await updateSprint(PROJECT_ID, SPRINT_ID, null, makeFormData(validFields));
    expect(result?.globalError).toMatch(/authoris/i);
  });

  it("should return success on happy path", async () => {
    setupAuth();
    setupProjectAccess();
    const eq2   = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const eq1   = vi.fn(() => ({ eq: eq2 }));
    const update = vi.fn(() => ({ eq: eq1 }));
    mockFrom.mockReturnValueOnce({ update });

    const result = await updateSprint(PROJECT_ID, SPRINT_ID, null, makeFormData(validFields));
    expect(result?.success).toBe(true);
  });
});

// --- deleteSprint ---

describe("deleteSprint", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return AUTH_UNAUTHORIZED when not logged in", async () => {
    setupAuth(null);
    const result = await deleteSprint(PROJECT_ID, SPRINT_ID);
    expect(result.success).toBe(false);
    expect(result.globalError).toMatch(/authoris/i);
  });

  it("should return PROJECT_ACCESS_DENIED for wrong project", async () => {
    setupAuth();
    setupProjectAccess(false);
    const result = await deleteSprint(PROJECT_ID, SPRINT_ID);
    expect(result.success).toBe(false);
    expect(result.globalError).toMatch(/access/i);
  });

  it("should return success on happy path", async () => {
    setupAuth();
    setupProjectAccess();
    const eq2   = vi.fn().mockResolvedValue({ error: null });
    const eq1   = vi.fn(() => ({ eq: eq2 }));
    const del   = vi.fn(() => ({ eq: eq1 }));
    mockFrom.mockReturnValueOnce({ delete: del });

    const result = await deleteSprint(PROJECT_ID, SPRINT_ID);
    expect(result.success).toBe(true);
  });

  it("should return GENERIC error when DB delete fails", async () => {
    setupAuth();
    setupProjectAccess();
    const eq2   = vi.fn().mockResolvedValue({ error: new Error("db error") });
    const eq1   = vi.fn(() => ({ eq: eq2 }));
    const del   = vi.fn(() => ({ eq: eq1 }));
    mockFrom.mockReturnValueOnce({ delete: del });

    const result = await deleteSprint(PROJECT_ID, SPRINT_ID);
    expect(result.success).toBe(false);
    expect(result.globalError).toBeDefined();
  });
});
