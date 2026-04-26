import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseOpenAirExcel } from "@/lib/parsers/openair-parser";

function fixture(name: string): Buffer {
  return readFileSync(resolve(__dirname, "../fixtures", name));
}

function buildBuffer(sheets: Record<string, Record<string, unknown>[]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("openairParser", () => {
  describe("parseOpenAirExcel", () => {
    it("should parse timesheets from the Timesheets sheet", () => {
      const buf = fixture("openair-sample.xlsx");
      const result = parseOpenAirExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.timesheets).toHaveLength(8);

      const first = result.timesheets[0];
      expect(first.employeeName).toBe("Anna Müller");
      expect(first.role).toBe("Senior Consultant");
      expect(first.phase).toBe("Analyse");
      expect(first.plannedHours).toBe(40);
      expect(first.bookedHours).toBe(38);
    });

    it("should parse milestones from the Meilensteine sheet", () => {
      const buf = fixture("openair-sample.xlsx");
      const result = parseOpenAirExcel(buf);

      expect(result.milestones).toHaveLength(3);

      const first = result.milestones[0];
      expect(first.name).toBe("Kick-off");
      expect(first.status).toBe("completed");
    });

    it("should parse budget entries from the Budget sheet", () => {
      const buf = fixture("openair-sample.xlsx");
      const result = parseOpenAirExcel(buf);

      expect(result.budgetEntries).toHaveLength(4);

      const personal = result.budgetEntries[0];
      expect(personal.category).toBe("Personal");
      expect(personal.plannedEur).toBe(120000);
      expect(personal.actualEur).toBe(98000);
    });

    it("should produce no errors or warnings for a valid complete file", () => {
      const buf = fixture("openair-sample.xlsx");
      const result = parseOpenAirExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should add a warning when the Budget sheet is missing (openair-partial)", () => {
      const buf = fixture("openair-partial.xlsx");
      const result = parseOpenAirExcel(buf);

      expect(result.budgetEntries).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => /budget/i.test(w))).toBe(true);
    });

    it("should still parse timesheets and milestones from partial file", () => {
      const buf = fixture("openair-partial.xlsx");
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(8);
      expect(result.milestones).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it("should add a warning for negative booked hours (and still include the row)", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Mitarbeiter: "Eve",
            Rolle: "Consultant",
            Phase: "Test",
            "Geplante Stunden": 40,
            "Gebuchte Stunden": -5,
            Datum: "2024-01-31",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.warnings.some((w) => /negativ|negative/i.test(w))).toBe(true);
      expect(result.timesheets).toHaveLength(1);
      expect(result.timesheets[0].bookedHours).toBe(-5);
    });

    it("should ignore unknown columns without error", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Mitarbeiter: "Eve",
            Rolle: "Consultant",
            "Unbekannte Spalte": "xyz",
            "Gebuchte Stunden": 10,
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.timesheets).toHaveLength(1);
    });

    it("should skip empty rows in timesheets", () => {
      const buf = buildBuffer({
        Timesheets: [
          { Mitarbeiter: "Alice", Rolle: "SC", "Gebuchte Stunden": 20 },
          { Mitarbeiter: "", Rolle: "", "Gebuchte Stunden": "" },
          { Mitarbeiter: "Bob", Rolle: "C", "Gebuchte Stunden": 15 },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(2);
    });

    it("should detect a Timesheets block inside a generic sheet by column headers", () => {
      const buf = buildBuffer({
        "OpenAir Export": [
          { Mitarbeiter: "Alice", Rolle: "SC", Phase: "Analyse", "Gebuchte Stunden": 20 },
          { Mitarbeiter: "Bob", Rolle: "C", Phase: "Design", "Gebuchte Stunden": 30 },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(2);
      expect(result.timesheets[0].employeeName).toBe("Alice");
    });

    it("should handle a file with no data gracefully", () => {
      const buf = buildBuffer({ Sheet1: [] });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(0);
      expect(result.milestones).toHaveLength(0);
      expect(result.budgetEntries).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should recognise English column names for timesheets", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Employee: "Carol",
            Role: "Developer",
            Task: "Backend",
            "Planned Hours": 40,
            "Actual Hours": 35,
            Date: "2024-02-29",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(1);
      const ts = result.timesheets[0];
      expect(ts.employeeName).toBe("Carol");
      expect(ts.role).toBe("Developer");
      expect(ts.phase).toBe("Backend");
      expect(ts.plannedHours).toBe(40);
      expect(ts.bookedHours).toBe(35);
    });
  });

  describe("team extraction (FEAT-008)", () => {
    function newFormatRow(overrides: Record<string, unknown> = {}) {
      return {
        Date: "2026-01-15",
        Client: "Acme Corp",
        Project: "My Project - Team Alpha",
        Task: "Development",
        Hours: 8,
        Notes: "",
        Status: "submitted",
        ...overrides,
      };
    }

    it("should extract team name including 'Team' prefix from '- Team X' suffix", () => {
      const buf = buildBuffer({ Timesheets: [newFormatRow()] });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(1);
      expect(result.timesheets[0].team).toBe("Team Alpha");
    });

    it("should set team to undefined when no '- Team' suffix is present", () => {
      const buf = buildBuffer({
        Timesheets: [newFormatRow({ Project: "My Project" })],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].team).toBeUndefined();
    });

    it("should handle multi-word team names", () => {
      const buf = buildBuffer({
        Timesheets: [newFormatRow({ Project: "Rollout 2026 - Team Backend Core" })],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].team).toBe("Team Backend Core");
    });

    it("should handle en-dash separator (–) instead of ASCII hyphen", () => {
      const buf = buildBuffer({
        Timesheets: [newFormatRow({ Project: "2501P146179 – Team Panda" })],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].team).toBe("Team Panda");
    });

    it("should match real OpenAir project format with multiple segments", () => {
      const buf = buildBuffer({
        Timesheets: [
          newFormatRow({ Project: "2501P146179-PI26.1 Part 1 - Ost - ODP Dev - Team Panda" }),
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].team).toBe("Team Panda");
    });

    it("should set team to undefined when Project column is absent", () => {
      const buf = buildBuffer({
        Timesheets: [{ Date: "2026-01-01", Hours: 4, Status: "submitted" }],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].team).toBeUndefined();
    });
  });

  describe("ticketRef extraction (FEAT-008)", () => {
    function rowWithNotes(notes: string, status = "submitted") {
      return {
        Date: "2026-01-15",
        Project: "My Project - Team A",
        Task: "Development",
        Hours: 4,
        Notes: notes,
        Status: status,
      };
    }

    it("should extract a Jira ticket ref from Notes", () => {
      const buf = buildBuffer({
        Timesheets: [rowWithNotes("worked on ABC-123 today")],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].ticketRef).toBe("ABC-123");
    });

    it("should extract the first ticket ref when multiple are present", () => {
      const buf = buildBuffer({
        Timesheets: [rowWithNotes("ABC-10 and XY-999 both done")],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].ticketRef).toBe("ABC-10");
    });

    it("should set ticketRef to undefined when Notes contains no ticket ref", () => {
      const buf = buildBuffer({
        Timesheets: [rowWithNotes("regular standup and planning")],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].ticketRef).toBeUndefined();
    });

    it("should set ticketRef to undefined when Notes column is absent", () => {
      const buf = buildBuffer({
        Timesheets: [
          { Date: "2026-01-01", Project: "P - Team A", Task: "Development", Hours: 4, Status: "submitted" },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].ticketRef).toBeUndefined();
    });

    it("should set ticketRef to undefined when Notes is empty", () => {
      const buf = buildBuffer({
        Timesheets: [rowWithNotes("")],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].ticketRef).toBeUndefined();
    });
  });

  describe("taskCategory validation (FEAT-008)", () => {
    const validCategories = ["Regular Meeting", "Development", "Steuerung", "Organization"];

    for (const cat of validCategories) {
      it(`should set taskCategory = "${cat}" for known category`, () => {
        const buf = buildBuffer({
          Timesheets: [
            {
              Date: "2026-01-01",
              Project: "P - Team A",
              Task: cat,
              Hours: 4,
              Status: "submitted",
            },
          ],
        });
        const result = parseOpenAirExcel(buf);

        expect(result.timesheets[0].taskCategory).toBe(cat);
      });
    }

    it("should set taskCategory to undefined for unknown task value", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Date: "2026-01-01",
            Project: "P - Team A",
            Task: "Something Else",
            Hours: 4,
            Status: "submitted",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].taskCategory).toBeUndefined();
    });

    it("should emit a warning for unknown task category in new-format files", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Date: "2026-01-01",
            Project: "P - Team A",
            Task: "Unknown Task",
            Hours: 4,
            Status: "submitted",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.warnings.some((w) => /task|category/i.test(w))).toBe(true);
    });

    it("should NOT emit a taskCategory warning for old-format files without Project column", () => {
      const buf = buildBuffer({
        Timesheets: [
          { Mitarbeiter: "Alice", Rolle: "SC", Phase: "Analyse", "Gebuchte Stunden": 20 },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.warnings.every((w) => !/task|category/i.test(w))).toBe(true);
    });

    it("should match 'Organization (PO & ScM)' to canonical category 'Organization'", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Date: "2026-01-01",
            Project: "P - Team A",
            Task: "Organization (PO & ScM)",
            Hours: 3,
            Status: "submitted",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].taskCategory).toBe("Organization");
      expect(result.warnings.every((w) => !/task|category/i.test(w))).toBe(true);
    });

    it("should not stop parsing after a row with task 'Steuerung' (eur substring false-positive)", () => {
      const buf = buildBuffer({
        Timesheets: [
          { Date: "2026-01-01", Project: "P - Team A", Task: "Development", Hours: 4, Status: "submitted" },
          { Date: "2026-01-02", Project: "P - Team A", Task: "Steuerung", Hours: 2, Status: "submitted" },
          { Date: "2026-01-03", Project: "P - Team A", Task: "Development", Hours: 6, Status: "submitted" },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(3);
    });

    it("should match 'Regular Meeting - Weekly Sync' to canonical category 'Regular Meeting'", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Date: "2026-01-01",
            Project: "P - Team A",
            Task: "Regular Meeting - Weekly Sync",
            Hours: 1,
            Status: "approved",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets[0].taskCategory).toBe("Regular Meeting");
      expect(result.warnings.every((w) => !/task|category/i.test(w))).toBe(true);
    });
  });

  describe("status-based row filtering (FEAT-008)", () => {
    function rowWithStatus(status: string) {
      return {
        Date: "2026-01-15",
        Project: "P - Team A",
        Task: "Development",
        Hours: 6,
        Notes: "",
        Status: status,
      };
    }

    it("should include rows with Status = submitted", () => {
      const buf = buildBuffer({ Timesheets: [rowWithStatus("submitted")] });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(1);
    });

    it("should include rows with Status = approved", () => {
      const buf = buildBuffer({ Timesheets: [rowWithStatus("approved")] });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(1);
    });

    it("should exclude rows with Status = rejected", () => {
      const buf = buildBuffer({ Timesheets: [rowWithStatus("rejected")] });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(0);
    });

    it("should exclude rows with Status = open", () => {
      const buf = buildBuffer({ Timesheets: [rowWithStatus("open")] });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(0);
    });

    it("should be case-insensitive for status values", () => {
      const buf = buildBuffer({
        Timesheets: [rowWithStatus("Submitted"), rowWithStatus("APPROVED")],
      });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(2);
    });

    it("should include all rows when no Status column is present (backward compat)", () => {
      const buf = buildBuffer({
        Timesheets: [
          { Mitarbeiter: "Alice", "Gebuchte Stunden": 10 },
          { Mitarbeiter: "Bob", "Gebuchte Stunden": 8 },
        ],
      });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(2);
    });

    it("should count only submitted+approved out of a mixed batch", () => {
      const buf = buildBuffer({
        Timesheets: [
          rowWithStatus("approved"),
          rowWithStatus("submitted"),
          rowWithStatus("rejected"),
          rowWithStatus("open"),
        ],
      });
      expect(parseOpenAirExcel(buf).timesheets).toHaveLength(2);
    });

    it("should emit a warning summarising the number of skipped rows", () => {
      const buf = buildBuffer({
        Timesheets: [
          rowWithStatus("approved"),
          rowWithStatus("rejected"),
          rowWithStatus("open"),
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.warnings.some((w) => /skip|reject|open/i.test(w))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should return undefined for plannedDate when a numeric (non-date) value is in the date column", () => {
      const buf = buildBuffer({
        Meilensteine: [
          { Name: "Launch", Geplant: 42, Status: "pending" },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].plannedDate).toBeUndefined();
    });

    it("should warn when a budget entry is missing the planned EUR value", () => {
      const buf = buildBuffer({
        Budget: [
          { Kategorie: "Reise", "Ist (EUR)": 5000 },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.warnings.some((w) => /missing/i.test(w))).toBe(true);
      expect(result.budgetEntries).toHaveLength(1);
      expect(result.budgetEntries[0].plannedEur).toBeUndefined();
    });

    it("should detect a budget block in a generic sheet via the fallback scanner", () => {
      const buf = buildBuffer({
        "Data Export": [
          { Kategorie: "Personal", "Geplant (EUR)": 100000, "Ist (EUR)": 80000 },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.budgetEntries).toHaveLength(1);
      expect(result.budgetEntries[0].category).toBe("Personal");
    });

    it("should detect a milestones block in a generic sheet via the fallback scanner", () => {
      const buf = buildBuffer({
        "Export Data": [
          { Name: "Kick-off", Geplant: "2024-01-15", Status: "completed" },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].name).toBe("Kick-off");
    });

    it("should skip milestone rows with an empty name", () => {
      const buf = buildBuffer({
        Meilensteine: [
          { Name: "", Geplant: "2024-01-01", Status: "pending" },
          { Name: "Go-Live", Geplant: "2024-06-01", Status: "planned" },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].name).toBe("Go-Live");
    });

    it("should return undefined for null/missing date cells and invalid date strings", () => {
      // Uses json_to_sheet with null values: XLSX skips null cells, sheet_to_json returns undefined for them.
      // { Name: "MS1", Geplant: null, Status: null }
      //   → cellDate(undefined): !undefined → true → return undefined  (line 61 branch)
      //   → cellString(undefined): undefined === null check → return ""  (line 50 branch)
      //   → "" || undefined → undefined  (line 269 binary-expr branch)
      // { Name: "MS2", Geplant: "bad-date" }
      //   → cellDate("bad-date"): new Date("bad-date") → isNaN → return undefined  (line 65 branch)
      const buf = buildBuffer({
        Meilensteine: [
          { Name: "MS1", Geplant: null, Status: null },
          { Name: "MS2", Geplant: "bad-date" },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(2);
      expect(result.milestones[0].plannedDate).toBeUndefined();
      expect(result.milestones[0].status).toBeUndefined();
      expect(result.milestones[1].plannedDate).toBeUndefined();
    });

    it("should set plannedDate and status to undefined when those columns are absent from the milestone sheet", () => {
      // Headers = ["Name"] only: colPlanned = -1 (line 267 false branch), colStatus = -1 (line 269 ternary false branch)
      const buf = buildBuffer({
        Meilensteine: [{ Name: "Launch" }],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(1);
      expect(result.milestones[0].plannedDate).toBeUndefined();
      expect(result.milestones[0].status).toBeUndefined();
    });

    it("should handle budget rows with null numeric cells and non-numeric values", () => {
      // "Geplant (EUR)": null → column exists, cell missing → cellNumber(undefined) (line 55 branch)
      // "Ist (EUR)": "abc"  → cellNumber("abc") → Number("abc") = NaN → return undefined (line 57 branch)
      const buf = buildBuffer({
        Budget: [
          { Kategorie: "Test", "Geplant (EUR)": null, "Ist (EUR)": "abc" },
        ],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.budgetEntries).toHaveLength(1);
      expect(result.budgetEntries[0].plannedEur).toBeUndefined();
      expect(result.budgetEntries[0].actualEur).toBeUndefined();
    });

    it("should skip whitespace rows and pass through non-matching headers in the fallback scanner", () => {
      // aoa_to_sheet lets us place rows in exact positions.
      // Whitespace-only cells pass the XLSX writer but isEmptyRow trims them → continue (line 306).
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["  ", "  "],                              // whitespace row → isEmptyRow → continue (line 306)
          ["Unknown", "Column", "Headers"],          // blockType = null → all three if-conditions false
          ["Mitarbeiter", "Gebuchte Stunden"],       // blockType = timesheets → line 311 true
          ["Alice", 10],
        ]),
        "Report",
      );
      const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      const result = parseOpenAirExcel(buf);
      expect(result.timesheets).toHaveLength(1);
    });

    it("should produce no milestones when the sheet has no Name column", () => {
      // colName = -1 → const name = "" → all rows skipped  (line 262 false branch)
      const buf = buildBuffer({
        Meilensteine: [{ Geplant: "2024-01-01", Status: "done" }],
      });
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(0);
    });

    it("should skip whitespace-only rows inside a named milestone sheet", () => {
      // isEmptyRow returns true for whitespace → continue  (line 260 branch)
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Name", "Geplant", "Status"],
          ["Kick-off", "2024-01-01", "done"],
          ["  ", "  ", "  "],              // whitespace row → isEmptyRow → continue
          ["Go-Live", "2024-06-01", "planned"],
        ]),
        "Meilensteine",
      );
      const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      const result = parseOpenAirExcel(buf);
      expect(result.milestones).toHaveLength(2);
    });
  });

  describe("budget warning suppression for new-format (FEAT-008)", () => {
    it("should NOT emit a budget warning for new-format timesheet-only exports", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Date: "2026-01-15",
            Project: "P - Team A",
            Task: "Development",
            Hours: 5,
            Status: "submitted",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.warnings.every((w) => !/budget/i.test(w))).toBe(true);
    });

    it("should still emit a budget warning for old-format files without budget sheet", () => {
      const buf = buildBuffer({
        Timesheets: [
          { Mitarbeiter: "Alice", Rolle: "SC", "Gebuchte Stunden": 10 },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.warnings.some((w) => /budget/i.test(w))).toBe(true);
    });
  });

  describe("full new-format row (FEAT-008)", () => {
    it("should parse a complete Date/Client/Project/Task/Hours/Notes/Status row", () => {
      const buf = buildBuffer({
        Timesheets: [
          {
            Date: "2026-03-10",
            Client: "Acme Corp",
            Project: "Rollout Beta - Team Omega",
            Task: "Development",
            Hours: 7.5,
            Notes: "finished ABC-42 implementation",
            Status: "approved",
          },
        ],
      });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(1);
      const ts = result.timesheets[0];
      expect(ts.team).toBe("Team Omega");
      expect(ts.ticketRef).toBe("ABC-42");
      expect(ts.taskCategory).toBe("Development");
      expect(ts.bookedHours).toBe(7.5);
      expect(ts.phase).toBe("Development");
    });
  });
});
