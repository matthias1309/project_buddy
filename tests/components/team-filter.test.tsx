import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockPush = vi.fn();
const mockGetAll = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter:      () => ({ push: mockPush }),
  usePathname:    () => "/projects/proj-1",
  useSearchParams: () => ({
    getAll:   mockGetAll,
    toString: () => "",
  }),
}));

import { TeamFilter } from "@/components/shared/team-filter";

const TEAMS = ["Team Alpha", "Team Panda", "Team Oolong"];

describe("TeamFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockReturnValue([]);
  });

  it("renders nothing when teams list is empty", () => {
    const { container } = render(<TeamFilter teams={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "All teams" label when no team is selected', () => {
    render(<TeamFilter teams={TEAMS} />);
    expect(screen.getByText("All teams")).toBeInTheDocument();
  });

  it("shows the team name when exactly one team is selected", () => {
    mockGetAll.mockReturnValue(["Team Alpha"]);
    render(<TeamFilter teams={TEAMS} />);
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
  });

  it('shows "N teams" when multiple teams are selected', () => {
    mockGetAll.mockReturnValue(["Team Alpha", "Team Panda"]);
    render(<TeamFilter teams={TEAMS} />);
    expect(screen.getByText("2 teams")).toBeInTheDocument();
  });

  it("renders the Team label", () => {
    render(<TeamFilter teams={TEAMS} />);
    expect(screen.getByText("Team")).toBeInTheDocument();
  });
});
