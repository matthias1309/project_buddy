import type {
  JiraIssue,
  OATimesheet,
  BugPriority,
  OpenBugsByPriority,
  AvgHoursByPriority,
  BugLeadTimeRow,
  QualityThresholds,
} from "@/types/domain.types";

// Anonymous Gregorian algorithm for Easter Sunday.
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Returns all 9 German federal (Bundes-) holidays for the given year.
export function germanHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  return [
    new Date(year, 0, 1),         // New Year's Day
    addDays(easter, -2),           // Good Friday
    addDays(easter, 1),            // Easter Monday
    new Date(year, 4, 1),          // Labour Day
    addDays(easter, 39),           // Ascension Thursday
    addDays(easter, 50),           // Whit Monday
    new Date(year, 9, 3),          // German Unity Day
    new Date(year, 11, 25),        // Christmas Day
    new Date(year, 11, 26),        // Boxing Day
  ];
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildHolidaySet(years: number[]): Set<string> {
  const set = new Set<string>();
  for (const year of years) {
    for (const h of germanHolidays(year)) {
      set.add(toDateKey(h));
    }
  }
  return set;
}

// Counts German working days between start (exclusive) and end (inclusive).
// Returns 0 when end <= start.
export function calcWorkingDays(start: Date, end: Date): number {
  if (end <= start) return 0;

  const years = new Set<number>();
  const cursor = new Date(start);
  while (cursor <= end) {
    years.add(cursor.getFullYear());
    cursor.setFullYear(cursor.getFullYear() + 1);
  }
  const holidays = buildHolidaySet([...years]);

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // start is exclusive

  while (current <= end) {
    const dow = current.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6 && !holidays.has(toDateKey(current))) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function normalizePriority(p: string | undefined): BugPriority | "unknown" {
  if (p === "Critical" || p === "Major" || p === "Minor" || p === "Trivial") {
    return p;
  }
  return "unknown";
}

// Open bugs = bugs with no resolvedDate, grouped by priority.
export function calcOpenBugsByPriority(bugs: JiraIssue[]): OpenBugsByPriority {
  const result: OpenBugsByPriority = { critical: 0, major: 0, minor: 0, trivial: 0, unknown: 0 };
  for (const bug of bugs) {
    if (bug.resolvedDate) continue;
    const key = normalizePriority(bug.priority);
    result[key === "Critical" ? "critical"
         : key === "Major"    ? "major"
         : key === "Minor"    ? "minor"
         : key === "Trivial"  ? "trivial"
         : "unknown"]++;
  }
  return result;
}

// Mean OA hours per bug grouped by priority.
// Bugs with no bookings contribute 0h to the group mean.
// Returns null for a priority bucket with no bugs.
export function calcAvgHoursByPriority(
  bugs: JiraIssue[],
  timesheets: OATimesheet[],
): AvgHoursByPriority {
  type Bucket = { totalHours: number; count: number };
  const buckets: Record<string, Bucket> = {
    Critical: { totalHours: 0, count: 0 },
    Major:    { totalHours: 0, count: 0 },
    Minor:    { totalHours: 0, count: 0 },
    Trivial:  { totalHours: 0, count: 0 },
    unknown:  { totalHours: 0, count: 0 },
  };

  // Pre-aggregate hours by ticketRef (case-insensitive key match)
  const hoursByTicket = new Map<string, number>();
  for (const ts of timesheets) {
    if (!ts.ticketRef) continue;
    const key = ts.ticketRef.trim().toUpperCase();
    hoursByTicket.set(key, (hoursByTicket.get(key) ?? 0) + (ts.bookedHours ?? 0));
  }

  for (const bug of bugs) {
    const bucketKey = normalizePriority(bug.priority);
    const bucket = buckets[bucketKey === "unknown" ? "unknown" : bucketKey];
    const hours = hoursByTicket.get(bug.issueKey.trim().toUpperCase()) ?? 0;
    bucket.totalHours += hours;
    bucket.count++;
  }

  return {
    critical: buckets["Critical"].count > 0 ? buckets["Critical"].totalHours / buckets["Critical"].count : null,
    major:    buckets["Major"].count    > 0 ? buckets["Major"].totalHours    / buckets["Major"].count    : null,
    minor:    buckets["Minor"].count    > 0 ? buckets["Minor"].totalHours    / buckets["Minor"].count    : null,
    trivial:  buckets["Trivial"].count  > 0 ? buckets["Trivial"].totalHours  / buckets["Trivial"].count  : null,
    unknown:  buckets["unknown"].count  > 0 ? buckets["unknown"].totalHours  / buckets["unknown"].count  : null,
  };
}

// Lead time rows for all closed bugs (resolvedDate present).
// Excludes bugs with no createdDate.
export function calcBugLeadTimes(
  bugs: JiraIssue[],
  thresholds: QualityThresholds,
): BugLeadTimeRow[] {
  const thresholdFor: Record<BugPriority, number> = {
    Critical: thresholds.criticalDays,
    Major:    thresholds.majorDays,
    Minor:    thresholds.minorDays,
    Trivial:  thresholds.trivialDays,
  };

  const rows: BugLeadTimeRow[] = [];
  for (const bug of bugs) {
    if (!bug.resolvedDate || !bug.createdDate) continue;

    const leadTimeDays = calcWorkingDays(bug.createdDate, bug.resolvedDate);
    const prio = normalizePriority(bug.priority);
    const priority: BugPriority | null = prio === "unknown" ? null : prio;

    let leadTimeStatus: BugLeadTimeRow["leadTimeStatus"];
    if (!priority) {
      leadTimeStatus = "none";
    } else {
      leadTimeStatus = leadTimeDays > thresholdFor[priority] ? "red" : "green";
    }

    rows.push({
      issueKey: bug.issueKey,
      summary: bug.summary,
      priority,
      createdDate: bug.createdDate,
      resolvedDate: bug.resolvedDate,
      leadTimeDays,
      leadTimeStatus,
    });
  }
  return rows;
}
