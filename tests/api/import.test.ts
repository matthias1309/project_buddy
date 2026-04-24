import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { JiraParseResult, OpenAirParseResult } from "@/types/domain.types";

// --- Mocks (must be declared before importing the route) ---

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const mockParseJira = vi.fn();
const mockParseOpenAir = vi.fn();

vi.mock("@/lib/parsers/jira-parser", () => ({
  parseJiraExcel: mockParseJira,
}));
vi.mock("@/lib/parsers/openair-parser", () => ({
  parseOpenAirExcel: mockParseOpenAir,
}));

// Import route AFTER mocks are registered
const { POST } = await import("@/app/api/projects/[id]/import/route");

// --- Helpers ---

const PROJECT_ID = "proj-1";
const LOG_ID = "log-1";
const USER_ID = "user-1";

function fakeFile(name: string, sizeBytes = 100): File {
  const file = new File([new Uint8Array(4)], name);
  // Override the size property so we can test the 10 MB limit without allocating real memory
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true });
  return file;
}

function makeRequest(
  entries: { file?: File | null; source?: string | null },
  projectId = PROJECT_ID,
): NextRequest {
  const fakeFormData = {
    get: (key: string) => {
      if (key === "file") return entries.file ?? null;
      if (key === "source") return entries.source ?? null;
      return null;
    },
  };
  return {
    formData: vi.fn().mockResolvedValue(fakeFormData),
  } as unknown as NextRequest;
}

const SMALL_XLSX = fakeFile("test.xlsx", 100);
const BIG_XLSX = fakeFile("big.xlsx", 11 * 1024 * 1024);

const JIRA_RESULT: JiraParseResult = {
  issues: [
    { issueKey: "PROJ-1", status: "Done" },
    { issueKey: "PROJ-2", status: "In Progress" },
  ],
  sprints: [{ sprintName: "Sprint 1", completedPoints: 5, plannedPoints: 8 }],
  errors: [],
  warnings: [],
};

const OA_RESULT: OpenAirParseResult = {
  timesheets: [{ employeeName: "Alice", bookedHours: 40 }],
  milestones: [{ name: "Go-Live" }],
  budgetEntries: [{ category: "Personal", plannedEur: 10000 }],
  errors: [],
  warnings: [],
};

// Builds a fully chainable Supabase mock; singleResult is the value returned by .single()
function buildChain(singleResult: unknown) {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => c;
  c.eq = vi.fn(self);
  c.select = vi.fn(self);
  c.insert = vi.fn(self);
  c.update = vi.fn(self);
  c.delete = vi.fn(self);
  c.single = vi.fn().mockResolvedValue(singleResult);
  return c;
}

function setupHappyPath() {
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });

  mockFrom.mockImplementation((table: string) => {
    if (table === "projects") {
      return buildChain({ data: { id: PROJECT_ID }, error: null });
    }
    if (table === "import_logs") {
      // handles both the INSERT (.select().single()) and the UPDATE (.eq())
      const c = buildChain({ data: { id: LOG_ID }, error: null });
      c.update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
      return c;
    }
    // jira_issues, jira_sprints, oa_* tables
    const c = buildChain({ data: null, error: null });
    c.insert = vi.fn().mockResolvedValue({ error: null });
    c.delete = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    return c;
  });
}

// --- Tests ---

describe("POST /api/projects/[id]/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest({ file: SMALL_XLSX, source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("AUTH_UNAUTHORIZED");
  });

  it("returns 403 when user has no access to the project", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      buildChain({ data: null, error: { message: "not found" } }),
    );

    const res = await POST(
      makeRequest({ file: SMALL_XLSX, source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("PROJECT_ACCESS_DENIED");
  });

  it("returns 413 when file exceeds 10 MB", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      buildChain({ data: { id: PROJECT_ID }, error: null }),
    );

    const res = await POST(
      makeRequest({ file: BIG_XLSX, source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("IMPORT_FILE_TOO_LARGE");
  });

  it("returns 422 when file has wrong extension", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      buildChain({ data: { id: PROJECT_ID }, error: null }),
    );

    const res = await POST(
      makeRequest({ file: fakeFile("export.csv", 100), source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("IMPORT_INVALID_FILE_TYPE");
  });

  it("returns 400 when source is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      buildChain({ data: { id: PROJECT_ID }, error: null }),
    );

    const res = await POST(
      makeRequest({ file: SMALL_XLSX, source: "unknown" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when no file is provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockFrom.mockReturnValue(
      buildChain({ data: { id: PROJECT_ID }, error: null }),
    );

    const res = await POST(
      makeRequest({ file: null, source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(400);
  });

  it("returns 200 with correct recordsImported for a valid Jira upload", async () => {
    setupHappyPath();
    mockParseJira.mockReturnValue(JIRA_RESULT);

    const res = await POST(
      makeRequest({ file: fakeFile("jira.xlsx", 200), source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recordsImported).toBe(3); // 2 issues + 1 sprint
    expect(body.errors).toHaveLength(0);
    expect(body.importLogId).toBe(LOG_ID);
  });

  it("returns 200 with correct recordsImported for a valid OpenAir upload", async () => {
    setupHappyPath();
    mockParseOpenAir.mockReturnValue(OA_RESULT);

    const res = await POST(
      makeRequest({ file: fakeFile("openair.xlsx", 200), source: "openair" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recordsImported).toBe(3); // 1 timesheet + 1 milestone + 1 budget entry
  });

  it("includes parse errors in the response and still returns 200", async () => {
    setupHappyPath();
    mockParseJira.mockReturnValue({
      ...JIRA_RESULT,
      issues: [],
      errors: [{ row: 3, message: 'Missing required field "Issue Key" in row 3' }],
    });

    const res = await POST(
      makeRequest({ file: fakeFile("broken.xlsx", 200), source: "jira" }),
      { params: { id: PROJECT_ID } },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(3);
  });
});
