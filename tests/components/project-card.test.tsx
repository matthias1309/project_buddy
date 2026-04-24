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

const defaultStability = {
  stabilityStatus: "none" as const,
  criticalDimension: null,
  hint: null,
};

describe("ProjectCard — FEAT-002 project card content", () => {
  it("renders the project name", () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />
    );
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
  });

  it("renders the project number when set", () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />
    );
    expect(screen.getByText("PRJ-001")).toBeInTheDocument();
  });

  it("does not render a project number when null", () => {
    render(
      <ProjectCard
        project={{ ...baseProject, project_number: null }}
        lastImportedAt={null}
        {...defaultStability}
      />
    );
    expect(screen.queryByText(/PRJ/)).not.toBeInTheDocument();
  });

  it('renders the "No Data" badge when stabilityStatus is "none"', () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />
    );
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it('renders the "Stable" badge when stabilityStatus is "green"', () => {
    render(
      <ProjectCard
        project={baseProject}
        lastImportedAt={null}
        stabilityStatus="green"
        criticalDimension={null}
        hint={null}
      />
    );
    expect(screen.getByText("Stable")).toBeInTheDocument();
  });

  it("renders the critical dimension hint when provided", () => {
    render(
      <ProjectCard
        project={baseProject}
        lastImportedAt={null}
        stabilityStatus="red"
        criticalDimension="budget"
        hint="+28.5%"
      />
    );
    expect(screen.getByText(/Budget/)).toBeInTheDocument();
    expect(screen.getByText("+28.5%")).toBeInTheDocument();
  });
});

describe("ProjectCard — FEAT-002 import date display", () => {
  it('shows "No data imported yet" when lastImportedAt is null', () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />
    );
    expect(screen.getByText("No data imported yet")).toBeInTheDocument();
  });

  it("shows the formatted import date when lastImportedAt is provided", () => {
    render(
      <ProjectCard
        project={baseProject}
        lastImportedAt="2024-06-15T10:00:00Z"
        {...defaultStability}
      />
    );
    expect(screen.getByText(/Last import:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 2024/)).toBeInTheDocument();
  });
});

describe("ProjectCard — FEAT-002 navigation", () => {
  it("links to the project detail page", () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/projects/proj-1"
    );
  });
});
