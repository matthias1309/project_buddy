import { describe, it, expect } from "vitest";
import type { OATimesheet, JiraIssue, EpicBudgetRow } from "@/types/domain.types";
import {
  filterTimesheets,
  calcEpicBudget,
  calcEpicTileSummary,
} from "@/lib/calculations/epic-calculations";

function makeTimesheet(overrides: Partial<OATimesheet> = {}): OATimesheet {
  return { bookedHours: 8, ...overrides };
}

function makeEpic(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return { issueKey: "EPIC-1", status: "In Progress", issueType: "Epic", ...overrides };
}

function makeStory(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return { issueKey: "PROJ-1", status: "Done", issueType: "Story", epic: "EPIC-1", ...overrides };
}

describe("epic-calculations", () => {
  describe("filterTimesheets", () => {
    it("should keep all entries when no filter is supplied", () => {
      const ts = [makeTimesheet({ ticketRef: "A" }), makeTimesheet({ ticketRef: "B" })];
      expect(filterTimesheets(ts, {})).toHaveLength(2);
    });

    it("should filter by team", () => {
      const ts = [
        makeTimesheet({ team: "Alpha", ticketRef: "PROJ-1" }),
        makeTimesheet({ team: "Beta", ticketRef: "PROJ-2" }),
      ];
      const result = filterTimesheets(ts, { team: "Alpha" });
      expect(result).toHaveLength(1);
      expect(result[0].ticketRef).toBe("PROJ-1");
    });

    it("should filter by dateFrom (inclusive)", () => {
      const ts = [
        makeTimesheet({ periodDate: new Date("2024-01-01"), ticketRef: "PROJ-1" }),
        makeTimesheet({ periodDate: new Date("2024-01-15"), ticketRef: "PROJ-2" }),
        makeTimesheet({ periodDate: new Date("2024-02-01"), ticketRef: "PROJ-3" }),
      ];
      const result = filterTimesheets(ts, { dateFrom: new Date("2024-01-15") });
      expect(result).toHaveLength(2);
    });

    it("should filter by dateTo (inclusive)", () => {
      const ts = [
        makeTimesheet({ periodDate: new Date("2024-01-01"), ticketRef: "PROJ-1" }),
        makeTimesheet({ periodDate: new Date("2024-01-15"), ticketRef: "PROJ-2" }),
        makeTimesheet({ periodDate: new Date("2024-02-01"), ticketRef: "PROJ-3" }),
      ];
      const result = filterTimesheets(ts, { dateTo: new Date("2024-01-15") });
      expect(result).toHaveLength(2);
    });

    it("should exclude entries with no periodDate when a date filter is active", () => {
      const ts = [
        makeTimesheet({ ticketRef: "PROJ-1" }), // no periodDate
        makeTimesheet({ periodDate: new Date("2024-01-20"), ticketRef: "PROJ-2" }),
      ];
      const result = filterTimesheets(ts, { dateFrom: new Date("2024-01-01") });
      expect(result).toHaveLength(1);
      expect(result[0].ticketRef).toBe("PROJ-2");
    });

    it("should filter with combined team and date range", () => {
      const ts = [
        makeTimesheet({ team: "Alpha", periodDate: new Date("2024-01-05"), ticketRef: "PROJ-1" }),
        makeTimesheet({ team: "Alpha", periodDate: new Date("2024-02-05"), ticketRef: "PROJ-2" }),
        makeTimesheet({ team: "Beta", periodDate: new Date("2024-01-05"), ticketRef: "PROJ-3" }),
      ];
      const result = filterTimesheets(ts, {
        team: "Alpha",
        dateFrom: new Date("2024-01-01"),
        dateTo: new Date("2024-01-31"),
      });
      expect(result).toHaveLength(1);
      expect(result[0].ticketRef).toBe("PROJ-1");
    });

    it("should include timesheets from both sprint windows when using union range (min–max)", () => {
      // Sprint 1: Jan 1–14, Sprint 2: Feb 1–14 — union range: Jan 1 – Feb 14
      const ts = [
        makeTimesheet({ periodDate: new Date("2024-01-05"), ticketRef: "PROJ-1" }), // sprint 1
        makeTimesheet({ periodDate: new Date("2024-01-20"), ticketRef: "PROJ-2" }), // gap
        makeTimesheet({ periodDate: new Date("2024-02-05"), ticketRef: "PROJ-3" }), // sprint 2
      ];
      const result = filterTimesheets(ts, {
        dateFrom: new Date("2024-01-01"),
        dateTo: new Date("2024-02-14"),
      });
      expect(result).toHaveLength(3);
    });

    it("should apply sprint + month filter as intersection", () => {
      // Sprint: Jan 15 – Feb 10; Month: January (Jan 1 – Jan 31)
      // Intersection: Jan 15 – Jan 31
      const ts = [
        makeTimesheet({ periodDate: new Date("2024-01-20"), ticketRef: "PROJ-1" }), // in both
        makeTimesheet({ periodDate: new Date("2024-02-05"), ticketRef: "PROJ-2" }), // sprint only
      ];
      const result = filterTimesheets(ts, {
        dateFrom: new Date("2024-01-15"),
        dateTo: new Date("2024-01-31"),
      });
      expect(result).toHaveLength(1);
      expect(result[0].ticketRef).toBe("PROJ-1");
    });
  });

  describe("calcEpicBudget", () => {
    it("should return green with 0 booked for epic with no OA bookings", () => {
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const rows = calcEpicBudget(epics, allIssues, [], 10);

      expect(rows).toHaveLength(1);
      expect(rows[0].bookedHours).toBe(0);
      expect(rows[0].bookedDays).toBe(0);
      expect(rows[0].usagePct).toBe(0);
      expect(rows[0].status).toBe("green");
    });

    it("should return unknown when epic has no T-Shirt size", () => {
      const epics = [makeEpic({ tShirtDays: undefined })];
      const allIssues = [makeStory()];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 16 })];

      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].plannedDays).toBeNull();
      expect(rows[0].usagePct).toBeNull();
      expect(rows[0].status).toBe("unknown");
    });

    it("should return yellow at exactly the warning threshold (90% with margin=10)", () => {
      // 9 days booked / 10 planned = 90 %
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 72 })]; // 72 h / 8 = 9 d

      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].usagePct).toBe(90);
      expect(rows[0].status).toBe("yellow");
    });

    it("should return red at exactly 100% usage", () => {
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 80 })]; // 80 h / 8 = 10 d

      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].usagePct).toBe(100);
      expect(rows[0].status).toBe("red");
    });

    it("should return green at 89% usage (just below warning threshold)", () => {
      // tShirtDays=100, 89 days booked → 89 %
      const epics = [makeEpic({ tShirtDays: 100 })];
      const allIssues = [makeStory()];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 712 })]; // 712 h / 8 = 89 d

      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].usagePct).toBe(89);
      expect(rows[0].status).toBe("green");
    });

    it("should return red at 101% usage", () => {
      const epics = [makeEpic({ tShirtDays: 100 })];
      const allIssues = [makeStory()];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 808 })]; // 808 h / 8 = 101 d

      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].usagePct).toBe(101);
      expect(rows[0].status).toBe("red");
    });

    it("should only count bookings from matching team when pre-filtered", () => {
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const all = [
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 40, team: "Alpha" }),
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 40, team: "Beta" }),
      ];
      const filtered = filterTimesheets(all, { team: "Alpha" });
      const rows = calcEpicBudget(epics, allIssues, filtered, 10);

      expect(rows[0].bookedHours).toBe(40);
    });

    it("should only count bookings within the date window when pre-filtered", () => {
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const all = [
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 16, periodDate: new Date("2024-01-10") }),
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 16, periodDate: new Date("2024-02-10") }),
      ];
      const filtered = filterTimesheets(all, {
        dateFrom: new Date("2024-01-01"),
        dateTo: new Date("2024-01-31"),
      });
      const rows = calcEpicBudget(epics, allIssues, filtered, 10);

      expect(rows[0].bookedHours).toBe(16);
    });

    it("should aggregate hours across multiple stories in the same epic", () => {
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [
        makeStory({ issueKey: "PROJ-1", epic: "EPIC-1" }),
        makeStory({ issueKey: "PROJ-2", epic: "EPIC-1" }),
      ];
      const timesheets = [
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 20 }),
        makeTimesheet({ ticketRef: "PROJ-2", bookedHours: 20 }),
      ];
      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].bookedHours).toBe(40);
    });

    it("should ignore timesheets whose ticketRef is not linked to any epic", () => {
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()]; // PROJ-1 → EPIC-1
      const timesheets = [
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 8 }),
        makeTimesheet({ ticketRef: "PROJ-ORPHAN", bookedHours: 40 }), // no story match
      ];
      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].bookedHours).toBe(8);
    });

    it("should correctly populate epicName from the epic issue summary", () => {
      const epics = [makeEpic({ issueKey: "EPIC-1", summary: "User Onboarding", tShirtDays: 5 })];
      const allIssues = [makeStory()];
      const rows = calcEpicBudget(epics, allIssues, [], 10);

      expect(rows[0].epicKey).toBe("EPIC-1");
      expect(rows[0].epicName).toBe("User Onboarding");
    });

    it("should sort rows by usagePct descending with nulls last", () => {
      const epics = [
        makeEpic({ issueKey: "EPIC-1", tShirtDays: 10 }),
        makeEpic({ issueKey: "EPIC-2", tShirtDays: 5 }),
        makeEpic({ issueKey: "EPIC-3", tShirtDays: undefined }),
      ];
      const allIssues = [
        makeStory({ issueKey: "PROJ-1", epic: "EPIC-1" }),
        makeStory({ issueKey: "PROJ-2", epic: "EPIC-2" }),
      ];
      const timesheets = [
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 40 }), // 5/10 = 50 %
        makeTimesheet({ ticketRef: "PROJ-2", bookedHours: 40 }), // 5/5  = 100 %
      ];
      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].epicKey).toBe("EPIC-2"); // 100 %
      expect(rows[1].epicKey).toBe("EPIC-1"); // 50 %
      expect(rows[2].epicKey).toBe("EPIC-3"); // null (last)
    });

    it("should skip issues in allIssues that have no epic field", () => {
      // Covers the false-branch of `if (issue.epic)` on the storyToEpic build
      const epics = [makeEpic({ tShirtDays: 5 })];
      const allIssues = [
        makeStory({ issueKey: "PROJ-1", epic: "EPIC-1" }), // linked
        { issueKey: "PROJ-X", status: "Done" } as JiraIssue, // no epic → skipped
      ];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 40 })];
      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].bookedHours).toBe(40);
    });

    it("should skip timesheets with no ticketRef without error", () => {
      // Covers the `if (!t.ticketRef) continue` branch (line 53)
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const timesheets = [
        makeTimesheet({ bookedHours: 99 }), // no ticketRef → skipped
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 8 }),
      ];
      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].bookedHours).toBe(8);
    });

    it("should treat undefined bookedHours as 0 when accumulating epic hours", () => {
      // Covers the `t.bookedHours ?? 0` fallback (line 56)
      const epics = [makeEpic({ tShirtDays: 10 })];
      const allIssues = [makeStory()];
      const timesheets = [
        { ticketRef: "PROJ-1" } as OATimesheet, // bookedHours undefined
        makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 16 }),
      ];
      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows[0].bookedHours).toBe(16);
    });

    it("should return 0 in sort comparator when both epics have null usagePct", () => {
      // Covers `return 0` on line 79 — two consecutive unknowns compared
      const epics = [
        makeEpic({ issueKey: "EPIC-1", tShirtDays: undefined }),
        makeEpic({ issueKey: "EPIC-2", tShirtDays: undefined }),
      ];
      const rows = calcEpicBudget(epics, [], [], 10);

      // Both are unknown; relative order is stable (no crash, both present)
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.status === "unknown")).toBe(true);
    });

    it("should match epics case-insensitively when the issue type differs in capitalisation", () => {
      const epics = [makeEpic({ issueKey: "EPIC-1", issueType: "EPIC", tShirtDays: 5 })];
      const allIssues = [makeStory()];
      const timesheets = [makeTimesheet({ ticketRef: "PROJ-1", bookedHours: 40 })];

      const rows = calcEpicBudget(epics, allIssues, timesheets, 10);

      expect(rows).toHaveLength(1);
      expect(rows[0].bookedHours).toBe(40);
    });
  });

  describe("calcEpicTileSummary", () => {
    it("should count overbooked (red) and nearLimit (yellow) correctly", () => {
      const rows: EpicBudgetRow[] = [
        { epicKey: "E1", epicName: null, plannedDays: 10, bookedHours: 80, bookedDays: 10, usagePct: 100, status: "red" },
        { epicKey: "E2", epicName: null, plannedDays: 10, bookedHours: 72, bookedDays: 9, usagePct: 90, status: "yellow" },
        { epicKey: "E3", epicName: null, plannedDays: 10, bookedHours: 40, bookedDays: 5, usagePct: 50, status: "green" },
        { epicKey: "E4", epicName: null, plannedDays: null, bookedHours: 0, bookedDays: 0, usagePct: null, status: "unknown" },
      ];
      const summary = calcEpicTileSummary(rows);

      expect(summary.overbooked).toBe(1);
      expect(summary.nearLimit).toBe(1);
    });

    it("should return zero counts for an empty row list", () => {
      const summary = calcEpicTileSummary([]);
      expect(summary.overbooked).toBe(0);
      expect(summary.nearLimit).toBe(0);
    });

    it("should not count unknown status in either bucket", () => {
      const rows: EpicBudgetRow[] = [
        { epicKey: "E1", epicName: null, plannedDays: null, bookedHours: 8, bookedDays: 1, usagePct: null, status: "unknown" },
      ];
      const summary = calcEpicTileSummary(rows);
      expect(summary.overbooked).toBe(0);
      expect(summary.nearLimit).toBe(0);
    });

    it("should count multiple red epics correctly", () => {
      const rows: EpicBudgetRow[] = [
        { epicKey: "E1", epicName: null, plannedDays: 10, bookedHours: 88, bookedDays: 11, usagePct: 110, status: "red" },
        { epicKey: "E2", epicName: null, plannedDays: 10, bookedHours: 80, bookedDays: 10, usagePct: 100, status: "red" },
      ];
      const summary = calcEpicTileSummary(rows);
      expect(summary.overbooked).toBe(2);
      expect(summary.nearLimit).toBe(0);
    });
  });
});
