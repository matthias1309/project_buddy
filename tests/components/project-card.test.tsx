import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectCard } from "@/components/dashboard/project-card";
import type { Database } from "@/types/database.types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
  monthlyHours: null,
};

describe("ProjectCard — FEAT-002 project card content", () => {
  it("renders the project name", () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />);
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
  });

  it("renders the project number when set", () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />);
    expect(screen.getByText("PRJ-001")).toBeInTheDocument();
  });

  it("does not render a project number when null", () => {
    render(
      <ProjectCard
        project={{ ...baseProject, project_number: null }}
        lastImportedAt={null}
        {...defaultStability}
      />,
    );
    expect(screen.queryByText(/PRJ/)).not.toBeInTheDocument();
  });

  it('renders the "No Data" badge when stabilityStatus is "none"', () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />);
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
        monthlyHours={null}
      />,
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
        monthlyHours={null}
      />,
    );
    expect(screen.getByText(/Budget/)).toBeInTheDocument();
    expect(screen.getByText("+28.5%")).toBeInTheDocument();
  });
});

describe("ProjectCard — FEAT-002 import date display", () => {
  it('shows "No data imported yet" when lastImportedAt is null', () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />);
    expect(screen.getByText("No data imported yet")).toBeInTheDocument();
  });

  it("shows the formatted import date when lastImportedAt is provided", () => {
    render(
      <ProjectCard
        project={baseProject}
        lastImportedAt="2024-06-15T10:00:00Z"
        {...defaultStability}
      />,
    );
    expect(screen.getByText(/Last import:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 2024/)).toBeInTheDocument();
  });
});

describe("ProjectCard — FEAT-002 navigation", () => {
  it("navigates to the project detail page when the card is clicked", () => {
    mockPush.mockClear();
    render(<ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />);
    fireEvent.click(screen.getByText("Alpha Project"));
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1");
  });
});

describe("ProjectCard — FEAT-008 time row", () => {
  it('shows "—" when monthlyHours is null (no OA import)', () => {
    render(<ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows formatted hours when monthlyHours is a whole number", () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} monthlyHours={42} />,
    );
    expect(screen.getByText("42 h")).toBeInTheDocument();
  });

  it("shows one decimal place for fractional hours", () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} monthlyHours={7.5} />,
    );
    expect(screen.getByText("7.5 h")).toBeInTheDocument();
  });

  it("shows 0 h when monthlyHours is 0 (import exists but no hours this month)", () => {
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} monthlyHours={0} />,
    );
    expect(screen.getByText("0 h")).toBeInTheDocument();
  });

  it("navigates to the time analysis page when the time row is clicked", () => {
    mockPush.mockClear();
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} monthlyHours={10} />,
    );
    fireEvent.click(screen.getByText("10 h"));
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1/time");
  });

  it("does not navigate to the project page when the time row is clicked", () => {
    mockPush.mockClear();
    render(
      <ProjectCard project={baseProject} lastImportedAt={null} {...defaultStability} monthlyHours={10} />,
    );
    fireEvent.click(screen.getByText("10 h"));
    expect(mockPush).not.toHaveBeenCalledWith("/projects/proj-1");
  });
});
