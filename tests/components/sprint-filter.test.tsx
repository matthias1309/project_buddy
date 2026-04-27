import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockPush = vi.fn();
const mockGetAll = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter:       () => ({ push: mockPush }),
  usePathname:     () => "/projects/proj-1",
  useSearchParams: () => ({
    getAll:   mockGetAll,
    toString: () => "",
  }),
}));

import { SprintFilter } from "@/components/shared/sprint-filter";

const SPRINTS = [
  { id: "s1", name: "CPI26.2.1 CW13/14 Oolong", start_date: "2026-03-30", end_date: "2026-04-11" },
  { id: "s2", name: "CPI26.2.1 CW15/16 Panda",  start_date: "2026-04-13", end_date: "2026-04-25" },
];

describe("SprintFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockReturnValue([]);
  });

  it("renders nothing when sprints list is empty", () => {
    const { container } = render(<SprintFilter sprints={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "All sprints" label when no sprint is selected', () => {
    render(<SprintFilter sprints={SPRINTS} />);
    expect(screen.getByText("All sprints")).toBeInTheDocument();
  });

  it("shows the sprint name when exactly one sprint is selected", () => {
    mockGetAll.mockReturnValue(["CPI26.2.1 CW13/14 Oolong"]);
    render(<SprintFilter sprints={SPRINTS} />);
    expect(screen.getByText("CPI26.2.1 CW13/14 Oolong")).toBeInTheDocument();
  });

  it('shows "N sprints" when multiple sprints are selected', () => {
    mockGetAll.mockReturnValue(["CPI26.2.1 CW13/14 Oolong", "CPI26.2.1 CW15/16 Panda"]);
    render(<SprintFilter sprints={SPRINTS} />);
    expect(screen.getByText("2 sprints")).toBeInTheDocument();
  });

  it("renders the Sprint label", () => {
    render(<SprintFilter sprints={SPRINTS} />);
    expect(screen.getByText("Sprint")).toBeInTheDocument();
  });
});
