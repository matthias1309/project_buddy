import { describe, it, expect } from "vitest";
import {
  calcHoursByTeam,
  calcHoursByCategory,
  calcEpicHours,
  calcBugCost,
} from "@/lib/calculations/time-calculations";
import type { OATimesheet, JiraIssue } from "@/types/domain.types";

function ts(overrides: Partial<OATimesheet> = {}): OATimesheet {
  return { bookedHours: 8, ...overrides };
}

function issue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return { issueKey: "ABC-1", status: "Done", ...overrides };
}

// ---------------------------------------------------------------------------

describe("calcHoursByTeam", () => {
  it("returns empty array for empty input", () => {
    expect(calcHoursByTeam([])).toEqual([]);
  });

  it("aggregates hours per team", () => {
    const result = calcHoursByTeam([
      ts({ team: "Alpha", bookedHours: 8 }),
      ts({ team: "Alpha", bookedHours: 4 }),
      ts({ team: "Beta", bookedHours: 6 }),
    ]);
    expect(result.find((r) => r.team === "Alpha")?.hours).toBe(12);
    expect(result.find((r) => r.team === "Beta")?.hours).toBe(6);
  });

  it("sorts result descending by hours", () => {
    const result = calcHoursByTeam([
      ts({ team: "A", bookedHours: 2 }),
      ts({ team: "B", bookedHours: 10 }),
      ts({ team: "C", bookedHours: 5 }),
    ]);
    expect(result[0].team).toBe("B");
    expect(result[1].team).toBe("C");
    expect(result[2].team).toBe("A");
  });

  it("excludes entries without a team", () => {
    const result = calcHoursByTeam([
      ts({ team: "Alpha", bookedHours: 8 }),
      ts({ team: undefined, bookedHours: 4 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].team).toBe("Alpha");
  });

  it("treats undefined bookedHours as 0", () => {
    const result = calcHoursByTeam([ts({ team: "Alpha", bookedHours: undefined })]);
    expect(result[0].hours).toBe(0);
  });

  it("handles a single team with a single entry", () => {
    const result = calcHoursByTeam([ts({ team: "Solo", bookedHours: 7 })]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ team: "Solo", hours: 7 });
  });
});

// ---------------------------------------------------------------------------

describe("calcHoursByCategory", () => {
  it("returns empty array for empty input", () => {
    expect(calcHoursByCategory([])).toEqual([]);
  });

  it("aggregates hours per taskCategory", () => {
    const result = calcHoursByCategory([
      ts({ taskCategory: "Development", bookedHours: 10 }),
      ts({ taskCategory: "Development", bookedHours: 5 }),
      ts({ taskCategory: "Regular Meeting", bookedHours: 3 }),
    ]);
    expect(result.find((r) => r.category === "Development")?.hours).toBe(15);
    expect(result.find((r) => r.category === "Regular Meeting")?.hours).toBe(3);
  });

  it("excludes entries without a taskCategory", () => {
    const result = calcHoursByCategory([
      ts({ taskCategory: "Development", bookedHours: 8 }),
      ts({ taskCategory: undefined, bookedHours: 4 }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("returns one entry per category when all four are present", () => {
    const result = calcHoursByCategory([
      ts({ taskCategory: "Development", bookedHours: 1 }),
      ts({ taskCategory: "Regular Meeting", bookedHours: 1 }),
      ts({ taskCategory: "Steuerung", bookedHours: 1 }),
      ts({ taskCategory: "Organization", bookedHours: 1 }),
    ]);
    expect(result).toHaveLength(4);
  });

  it("treats undefined bookedHours as 0", () => {
    const result = calcHoursByCategory([
      ts({ taskCategory: "Steuerung", bookedHours: undefined }),
    ]);
    expect(result[0].hours).toBe(0);
  });

  it("returns empty array when all entries lack a taskCategory", () => {
    const result = calcHoursByCategory([
      ts({ taskCategory: undefined }),
      ts({ taskCategory: undefined }),
    ]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe("calcEpicHours", () => {
  it("returns empty array when no entries have a ticketRef", () => {
    expect(calcEpicHours([ts({ ticketRef: undefined })], [])).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(calcEpicHours([], [])).toEqual([]);
  });

  it("groups hours by ticketRef", () => {
    const result = calcEpicHours(
      [
        ts({ ticketRef: "ABC-1", bookedHours: 4 }),
        ts({ ticketRef: "ABC-1", bookedHours: 3 }),
        ts({ ticketRef: "XY-99", bookedHours: 6 }),
      ],
      [],
    );
    expect(result.find((r) => r.ref === "ABC-1")?.hours).toBe(7);
    expect(result.find((r) => r.ref === "XY-99")?.hours).toBe(6);
  });

  it("sets storyPoints from matching JiraIssue", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-5", bookedHours: 4 })],
      [issue({ issueKey: "ABC-5", storyPoints: 3 })],
    );
    expect(result[0].storyPoints).toBe(3);
  });

  it("sets storyPoints to null when no matching JiraIssue exists", () => {
    const result = calcEpicHours([ts({ ticketRef: "ABC-99", bookedHours: 4 })], []);
    expect(result[0].storyPoints).toBeNull();
  });

  it("sets storyPoints to null when matched issue has no story points", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", storyPoints: undefined })],
    );
    expect(result[0].storyPoints).toBeNull();
  });

  it("excludes entries without a ticketRef", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 5 }), ts({ ticketRef: undefined, bookedHours: 10 })],
      [],
    );
    expect(result).toHaveLength(1);
  });

  it("treats undefined bookedHours as 0 when accumulating ticket hours", () => {
    const result = calcEpicHours([ts({ ticketRef: "ABC-1", bookedHours: undefined })], []);
    expect(result[0].hours).toBe(0);
  });

  it("sorts result descending by hours", () => {
    const result = calcEpicHours(
      [
        ts({ ticketRef: "ABC-1", bookedHours: 2 }),
        ts({ ticketRef: "ABC-2", bookedHours: 8 }),
        ts({ ticketRef: "ABC-3", bookedHours: 5 }),
      ],
      [],
    );
    expect(result[0].ref).toBe("ABC-2");
    expect(result[1].ref).toBe("ABC-3");
    expect(result[2].ref).toBe("ABC-1");
  });

  it("sets issueType from matching JiraIssue", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", issueType: "Bug" })],
    );
    expect(result[0].issueType).toBe("Bug");
  });

  it("sets issueType to null when no matching JiraIssue exists", () => {
    const result = calcEpicHours([ts({ ticketRef: "XYZ-99", bookedHours: 4 })], []);
    expect(result[0].issueType).toBeNull();
  });

  it("sets issueType to null when matched issue has no issueType", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", issueType: undefined })],
    );
    expect(result[0].issueType).toBeNull();
  });

  it("returns full summary when 25 chars or fewer", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", summary: "Short summary" })],
    );
    expect(result[0].summaryPreview).toBe("Short summary");
  });

  it("truncates summaryPreview at 25 chars and appends ellipsis", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", summary: "A".repeat(30) })],
    );
    expect(result[0].summaryPreview).toBe("A".repeat(25) + "…");
  });

  it("does not append ellipsis when summary is exactly 25 chars", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", summary: "A".repeat(25) })],
    );
    expect(result[0].summaryPreview).toBe("A".repeat(25));
  });

  it("sets summaryPreview to null when no matching JiraIssue exists", () => {
    const result = calcEpicHours([ts({ ticketRef: "XYZ-99", bookedHours: 4 })], []);
    expect(result[0].summaryPreview).toBeNull();
  });

  it("sets summaryPreview to null when matched issue has no summary", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", summary: undefined })],
    );
    expect(result[0].summaryPreview).toBeNull();
  });

  it("sets isDone to null when no matching JiraIssue exists", () => {
    const result = calcEpicHours([ts({ ticketRef: "XYZ-99", bookedHours: 4 })], []);
    expect(result[0].isDone).toBeNull();
  });

  it("sets isDone to true when matched issue status is 'Done'", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "Done" })],
    );
    expect(result[0].isDone).toBe(true);
  });

  it("sets isDone to true when matched issue status is 'Released'", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "Released" })],
    );
    expect(result[0].isDone).toBe(true);
  });

  it("sets isDone to true when matched issue status is 'Cancel'", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "Cancel" })],
    );
    expect(result[0].isDone).toBe(true);
  });

  it("sets isDone to true when matched issue status is 'In approval'", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "In approval" })],
    );
    expect(result[0].isDone).toBe(true);
  });

  it("sets isDone to false when matched issue status is 'In Progress'", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "In Progress" })],
    );
    expect(result[0].isDone).toBe(false);
  });

  it("sets isDone to false when matched issue status is 'Open'", () => {
    const result = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "Open" })],
    );
    expect(result[0].isDone).toBe(false);
  });

  it("isDone matching is case-insensitive", () => {
    const resultDone = calcEpicHours(
      [ts({ ticketRef: "ABC-1", bookedHours: 4 })],
      [issue({ issueKey: "ABC-1", status: "DONE" })],
    );
    expect(resultDone[0].isDone).toBe(true);

    const resultReleased = calcEpicHours(
      [ts({ ticketRef: "ABC-2", bookedHours: 4 })],
      [issue({ issueKey: "ABC-2", status: "RELEASED" })],
    );
    expect(resultReleased[0].isDone).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("calcBugCost", () => {
  it("returns { totalHours: 0, hoursPerSP: null } for empty input", () => {
    expect(calcBugCost([], [])).toEqual({ totalHours: 0, hoursPerSP: null });
  });

  it("returns totalHours 0 when no entries link to bug-type issues", () => {
    const result = calcBugCost(
      [ts({ ticketRef: "ABC-1", bookedHours: 8 })],
      [issue({ issueKey: "ABC-1", issueType: "Story", storyPoints: 5 })],
    );
    expect(result.totalHours).toBe(0);
  });

  it("sums hours for entries linked to Bug-type issues", () => {
    const result = calcBugCost(
      [
        ts({ ticketRef: "BUG-1", bookedHours: 4 }),
        ts({ ticketRef: "BUG-1", bookedHours: 2 }),
        ts({ ticketRef: "ABC-1", bookedHours: 8 }),
      ],
      [
        issue({ issueKey: "BUG-1", issueType: "Bug", storyPoints: 1 }),
        issue({ issueKey: "ABC-1", issueType: "Story", storyPoints: 5 }),
      ],
    );
    expect(result.totalHours).toBe(6);
  });

  it("calculates hoursPerSP as totalBugHours / totalStoryPoints across all issues", () => {
    // totalBugHours = 6, totalSP = 2 + 10 = 12
    const result = calcBugCost(
      [
        ts({ ticketRef: "BUG-1", bookedHours: 6 }),
        ts({ ticketRef: "ABC-1", bookedHours: 4 }),
      ],
      [
        issue({ issueKey: "BUG-1", issueType: "Bug", storyPoints: 2 }),
        issue({ issueKey: "ABC-1", issueType: "Story", storyPoints: 10 }),
      ],
    );
    expect(result.totalHours).toBe(6);
    expect(result.hoursPerSP).toBeCloseTo(6 / 12);
  });

  it("returns hoursPerSP null when total story points across all issues is 0", () => {
    const result = calcBugCost(
      [ts({ ticketRef: "BUG-1", bookedHours: 4 })],
      [issue({ issueKey: "BUG-1", issueType: "Bug", storyPoints: undefined })],
    );
    expect(result.hoursPerSP).toBeNull();
  });

  it("is case-insensitive when matching issue type 'bug'", () => {
    const result = calcBugCost(
      [ts({ ticketRef: "B-1", bookedHours: 3 })],
      [issue({ issueKey: "B-1", issueType: "bug", storyPoints: 1 })],
    );
    expect(result.totalHours).toBe(3);
  });

  it("ignores entries with no ticketRef", () => {
    const result = calcBugCost(
      [ts({ ticketRef: undefined, bookedHours: 99 })],
      [issue({ issueKey: "X-1", issueType: "Bug", storyPoints: 1 })],
    );
    expect(result.totalHours).toBe(0);
  });

  it("treats undefined bookedHours as 0 for bug-type timesheets", () => {
    const result = calcBugCost(
      [ts({ ticketRef: "BUG-1", bookedHours: undefined })],
      [issue({ issueKey: "BUG-1", issueType: "Bug", storyPoints: 1 })],
    );
    expect(result.totalHours).toBe(0);
  });

  it("counts bug hours correctly when multiple tickets mix bug and non-bug types", () => {
    const result = calcBugCost(
      [
        ts({ ticketRef: "B-1", bookedHours: 5 }),
        ts({ ticketRef: "S-1", bookedHours: 10 }),
        ts({ ticketRef: "B-2", bookedHours: 3 }),
      ],
      [
        issue({ issueKey: "B-1", issueType: "Bug", storyPoints: 1 }),
        issue({ issueKey: "S-1", issueType: "Story", storyPoints: 8 }),
        issue({ issueKey: "B-2", issueType: "Bug", storyPoints: 2 }),
      ],
    );
    expect(result.totalHours).toBe(8);
    expect(result.hoursPerSP).toBeCloseTo(8 / 11);
  });
});
