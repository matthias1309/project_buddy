import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Database } from "@/types/database.types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ getAll: () => [], set: vi.fn() })),
}));

import { createClient } from "@/lib/supabase/server";
import ProjectsPage from "@/app/(dashboard)/page";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const mockUser = { id: "user-1", email: "pm@example.com" };

const baseProject: Project = {
  id: "proj-1",
  owner_id: "user-1",
  name: "Alpha Project",
  project_number: "PRJ-001",
  description: null,
  client: null,
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  total_budget_eur: 100000,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function queryChain(data: unknown) {
  const promise = Promise.resolve({ data, error: null });
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.then = promise.then.bind(promise);
  chain.catch = promise.catch.bind(promise);
  chain.finally = promise.finally.bind(promise);
  chain[Symbol.toStringTag] = "Promise";
  return chain;
}

function setupClient({
  projects = [] as Project[],
  importLogs = [] as { project_id: string; imported_at: string }[],
} = {}) {
  vi.mocked(createClient).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      const data = table === "projects" ? projects : importLogs;
      return queryChain(data);
    }),
  } as unknown as ReturnType<typeof createClient>);
}

describe("ProjectsPage — FEAT-002 project list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a card for each project the user owns", async () => {
    setupClient({
      projects: [
        baseProject,
        { ...baseProject, id: "proj-2", name: "Beta Project" },
      ],
    });

    render(await ProjectsPage());

    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Project")).toBeInTheDocument();
  });

  it("shows the last import date when import logs exist", async () => {
    setupClient({
      projects: [baseProject],
      importLogs: [
        { project_id: "proj-1", imported_at: "2024-06-15T10:00:00Z" },
      ],
    });

    render(await ProjectsPage());

    expect(screen.getByText(/Last import:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 2024/)).toBeInTheDocument();
  });

  it('shows "No data imported yet" when a project has no import logs', async () => {
    setupClient({ projects: [baseProject], importLogs: [] });

    render(await ProjectsPage());

    expect(screen.getByText("No data imported yet")).toBeInTheDocument();
  });

  it('shows "New Project" button in the header regardless of project count', async () => {
    setupClient({ projects: [baseProject] });

    render(await ProjectsPage());

    expect(
      screen.getByRole("button", { name: "New Project" })
    ).toBeInTheDocument();
  });
});

describe("ProjectsPage — FEAT-002 empty state", () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "No projects yet" heading when user has no projects', async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it('shows "Create First Project" button in the empty state', async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(
      screen.getByRole("button", { name: "Create First Project" })
    ).toBeInTheDocument();
  });

  it("does not render any project cards in the empty state", async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it('shows "New Project" button in the empty state too', async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(
      screen.getByRole("button", { name: "New Project" })
    ).toBeInTheDocument();
  });
});
