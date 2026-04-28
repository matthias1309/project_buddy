import { describe, it, expect } from "vitest";
import {
  calcWorkingDays,
  germanHolidays,
  easterSunday,
  calcOpenBugsByPriority,
  calcAvgHoursByPriority,
  calcBugLeadTimes,
} from "@/lib/calculations/quality-calculations";
import type { JiraIssue, OATimesheet } from "@/types/domain.types";

// ---------------------------------------------------------------------------
// easterSunday
// ---------------------------------------------------------------------------

describe("easterSunday", () => {
  it("returns 2026-04-05 for 2026", () => {
    const d = easterSunday(2026);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // April = 3
    expect(d.getDate()).toBe(5);
  });

  it("returns 2025-04-20 for 2025", () => {
    const d = easterSunday(2025);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// germanHolidays
// ---------------------------------------------------------------------------

describe("germanHolidays", () => {
  it("includes New Year for 2026", () => {
    const holidays = germanHolidays(2026);
    const newYear = holidays.find(
      (d) => d.getMonth() === 0 && d.getDate() === 1,
    );
    expect(newYear).toBeDefined();
  });

  it("includes Good Friday 2026 (Apr 3)", () => {
    const holidays = germanHolidays(2026);
    const gf = holidays.find((d) => d.getMonth() === 3 && d.getDate() === 3);
    expect(gf).toBeDefined();
  });

  it("includes Easter Monday 2026 (Apr 6)", () => {
    const holidays = germanHolidays(2026);
    const em = holidays.find((d) => d.getMonth() === 3 && d.getDate() === 6);
    expect(em).toBeDefined();
  });

  it("includes German Unity Day (Oct 3)", () => {
    const holidays = germanHolidays(2026);
    const unity = holidays.find((d) => d.getMonth() === 9 && d.getDate() === 3);
    expect(unity).toBeDefined();
  });

  it("includes both Christmas days", () => {
    const holidays = germanHolidays(2026);
    const dec25 = holidays.find((d) => d.getMonth() === 11 && d.getDate() === 25);
    const dec26 = holidays.find((d) => d.getMonth() === 11 && d.getDate() === 26);
    expect(dec25).toBeDefined();
    expect(dec26).toBeDefined();
  });

  it("returns 9 holidays for 2026", () => {
    expect(germanHolidays(2026)).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// calcWorkingDays
// ---------------------------------------------------------------------------

describe("calcWorkingDays", () => {
  it("returns 0 when start === end (same day)", () => {
    const d = new Date("2026-01-05");
    expect(calcWorkingDays(d, d)).toBe(0);
  });

  it("returns 0 when resolved is before created", () => {
    expect(
      calcWorkingDays(new Date("2026-01-10"), new Date("2026-01-05")),
    ).toBe(0);
  });

  it("counts Mon to Fri (no holidays) as 4 working days", () => {
    // Mon 2026-01-05 → Fri 2026-01-09: Tue+Wed+Thu+Fri = 4
    expect(
      calcWorkingDays(new Date("2026-01-05"), new Date("2026-01-09")),
    ).toBe(4);
  });

  it("skips the weekend when spanning Mon–Mon", () => {
    // Mon 2026-01-05 → Mon 2026-01-12: Tue+Wed+Thu+Fri+Mon = 5
    expect(
      calcWorkingDays(new Date("2026-01-05"), new Date("2026-01-12")),
    ).toBe(5);
  });

  it("skips Good Friday and Easter Monday 2026", () => {
    // Thu 2026-04-02 → Wed 2026-04-08
    // Fri 03 = Good Friday (holiday), Sat 04 + Sun 05 = weekend, Mon 06 = Easter Monday (holiday)
    // Counted: Fri 03? no (holiday), Tue 07, Wed 08 → 2 working days
    expect(
      calcWorkingDays(new Date("2026-04-02"), new Date("2026-04-08")),
    ).toBe(2);
  });

  it("skips Christmas Day and Boxing Day", () => {
    // Wed 2026-12-23 → Mon 2026-12-28
    // Thu 24, Fri 25 (holiday), Sat 26 (holiday AND weekend), Sun 27 (weekend), Mon 28
    // Counted: Thu 24, Mon 28 → 2 working days
    expect(
      calcWorkingDays(new Date("2026-12-23"), new Date("2026-12-28")),
    ).toBe(2);
  });

  it("counts a single working day", () => {
    // Mon → Tue (no holiday)
    expect(
      calcWorkingDays(new Date("2026-01-05"), new Date("2026-01-06")),
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Helpers for KPI tests
// ---------------------------------------------------------------------------

function makeBug(
  overrides: Partial<JiraIssue> & { issueKey: string },
): JiraIssue {
  return {
    issueKey: overrides.issueKey,
    issueType: "Bug",
    status: overrides.status ?? "Open",
    priority: overrides.priority ?? undefined,
    team: overrides.team ?? undefined,
    summary: overrides.summary ?? undefined,
    createdDate: overrides.createdDate,
    resolvedDate: overrides.resolvedDate,
    storyPoints: undefined,
    sprint: overrides.sprint ?? undefined,
    epic: undefined,
    assignee: undefined,
  };
}

function makeTimesheet(ticketRef: string, hours: number): OATimesheet {
  return {
    ticketRef,
    bookedHours: hours,
    employeeName: undefined,
    role: undefined,
    phase: undefined,
    plannedHours: undefined,
    periodDate: undefined,
    team: undefined,
    taskCategory: undefined,
  };
}

// ---------------------------------------------------------------------------
// calcOpenBugsByPriority
// ---------------------------------------------------------------------------

describe("calcOpenBugsByPriority", () => {
  it("counts only open bugs (no resolvedDate) per priority", () => {
    const bugs: JiraIssue[] = [
      makeBug({ issueKey: "B-1", priority: "Critical" }),
      makeBug({ issueKey: "B-2", priority: "Critical" }),
      makeBug({ issueKey: "B-3", priority: "Major" }),
      makeBug({ issueKey: "B-4", priority: "Minor" }),
      makeBug({ issueKey: "B-5", priority: "Trivial" }),
      // closed bug — must not be counted
      makeBug({
        issueKey: "B-6",
        priority: "Critical",
        resolvedDate: new Date("2026-01-10"),
      }),
    ];
    const result = calcOpenBugsByPriority(bugs);
    expect(result.critical).toBe(2);
    expect(result.major).toBe(1);
    expect(result.minor).toBe(1);
    expect(result.trivial).toBe(1);
    expect(result.unknown).toBe(0);
  });

  it("groups bugs with no priority under unknown", () => {
    const bugs: JiraIssue[] = [
      makeBug({ issueKey: "B-1", priority: undefined }),
      makeBug({ issueKey: "B-2", priority: undefined }),
    ];
    const result = calcOpenBugsByPriority(bugs);
    expect(result.unknown).toBe(2);
    expect(result.critical).toBe(0);
  });

  it("returns all zeros for empty input", () => {
    const result = calcOpenBugsByPriority([]);
    expect(result).toEqual({ critical: 0, major: 0, minor: 0, trivial: 0, unknown: 0 });
  });
});

// ---------------------------------------------------------------------------
// calcAvgHoursByPriority
// ---------------------------------------------------------------------------

describe("calcAvgHoursByPriority", () => {
  it("returns mean hours for bugs with OA bookings", () => {
    const bugs: JiraIssue[] = [
      makeBug({ issueKey: "B-1", priority: "Critical" }),
      makeBug({ issueKey: "B-2", priority: "Critical" }),
    ];
    const timesheets: OATimesheet[] = [
      makeTimesheet("B-1", 4),
      makeTimesheet("B-1", 2), // B-1 total = 6h
      makeTimesheet("B-2", 10), // B-2 total = 10h
    ];
    const result = calcAvgHoursByPriority(bugs, timesheets);
    // avg = (6 + 10) / 2 = 8
    expect(result.critical).toBe(8);
  });

  it("counts bugs with no bookings as 0h in the average", () => {
    const bugs: JiraIssue[] = [
      makeBug({ issueKey: "B-1", priority: "Major" }),
      makeBug({ issueKey: "B-2", priority: "Major" }), // no timesheet
    ];
    const timesheets: OATimesheet[] = [makeTimesheet("B-1", 6)];
    const result = calcAvgHoursByPriority(bugs, timesheets);
    // avg = (6 + 0) / 2 = 3
    expect(result.major).toBe(3);
  });

  it("returns null for a priority with no bugs", () => {
    const bugs: JiraIssue[] = [makeBug({ issueKey: "B-1", priority: "Minor" })];
    const result = calcAvgHoursByPriority(bugs, []);
    expect(result.critical).toBeNull();
    expect(result.major).toBeNull();
    expect(result.trivial).toBeNull();
  });

  it("handles bugs with no priority under unknown", () => {
    const bugs: JiraIssue[] = [makeBug({ issueKey: "B-1", priority: undefined })];
    const timesheets: OATimesheet[] = [makeTimesheet("B-1", 5)];
    const result = calcAvgHoursByPriority(bugs, timesheets);
    expect(result.unknown).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// calcBugLeadTimes
// ---------------------------------------------------------------------------

describe("calcBugLeadTimes", () => {
  const thresholds = {
    criticalDays: 5,
    majorDays: 10,
    minorDays: 20,
    trivialDays: 50,
  };

  it("marks bug as red when lead time exceeds threshold", () => {
    const bugs: JiraIssue[] = [
      makeBug({
        issueKey: "B-1",
        priority: "Critical",
        createdDate: new Date("2026-01-05"), // Mon
        resolvedDate: new Date("2026-01-13"), // Tue next week → 6 working days
      }),
    ];
    const rows = calcBugLeadTimes(bugs, thresholds);
    expect(rows).toHaveLength(1);
    expect(rows[0].leadTimeStatus).toBe("red");
    expect(rows[0].leadTimeDays).toBe(6);
  });

  it("marks bug as green when lead time is exactly at threshold", () => {
    // Critical threshold = 5 days. Mon 05 Jan → Mon 12 Jan = 5 working days
    const bugs: JiraIssue[] = [
      makeBug({
        issueKey: "B-2",
        priority: "Critical",
        createdDate: new Date("2026-01-05"),
        resolvedDate: new Date("2026-01-12"),
      }),
    ];
    const rows = calcBugLeadTimes(bugs, thresholds);
    expect(rows[0].leadTimeStatus).toBe("green");
    expect(rows[0].leadTimeDays).toBe(5);
  });

  it("marks bug with no priority as status none", () => {
    const bugs: JiraIssue[] = [
      makeBug({
        issueKey: "B-3",
        priority: undefined,
        createdDate: new Date("2026-01-05"),
        resolvedDate: new Date("2026-01-20"),
      }),
    ];
    const rows = calcBugLeadTimes(bugs, thresholds);
    expect(rows[0].leadTimeStatus).toBe("none");
  });

  it("excludes open bugs (no resolvedDate)", () => {
    const bugs: JiraIssue[] = [
      makeBug({ issueKey: "B-4", priority: "Major" }), // no resolvedDate
    ];
    const rows = calcBugLeadTimes(bugs, thresholds);
    expect(rows).toHaveLength(0);
  });

  it("excludes bugs with no createdDate", () => {
    const bugs: JiraIssue[] = [
      makeBug({
        issueKey: "B-5",
        priority: "Major",
        resolvedDate: new Date("2026-01-20"),
      }),
    ];
    const rows = calcBugLeadTimes(bugs, thresholds);
    expect(rows).toHaveLength(0);
  });
});
