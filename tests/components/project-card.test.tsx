import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "@/components/dashboard/project-card";
import type { Database } from "@/types/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

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

describe("ProjectCard — FEAT-002 project card content", () => {
  it("renders the project name", () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} />);
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
  });

  it("renders the project number when set", () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} />);
    expect(screen.getByText("PRJ-001")).toBeInTheDocument();
  });

  it("does not render a project number when null", () => {
    render(
      <ProjectCard
        project={{ ...baseProject, project_number: null }}
        lastImportedAt={null}
      />
    );
    expect(screen.queryByText(/PRJ/)).not.toBeInTheDocument();
  });

  it('renders the stability badge as "Stable" (green placeholder)', () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} />);
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });
});

describe("ProjectCard — FEAT-002 import date display", () => {
  it('shows "No data imported yet" when lastImportedAt is null', () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} />);
    expect(screen.getByText("No data imported yet")).toBeInTheDocument();
  });

  it("shows the formatted import date when lastImportedAt is provided", () => {
    render(
      <ProjectCard
        project={baseProject}
        lastImportedAt="2024-06-15T10:00:00Z"
      />
    );
    expect(screen.getByText(/Last import:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 2024/)).toBeInTheDocument();
  });
});

describe("ProjectCard — FEAT-002 navigation", () => {
  it("links to the project detail page", () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/projects/proj-1"
    );
  });
});
