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

    it("should extract team name from '- Team X' suffix", () => {
      const buf = buildBuffer({ Timesheets: [newFormatRow()] });
      const result = parseOpenAirExcel(buf);

      expect(result.timesheets).toHaveLength(1);
      expect(result.timesheets[0].team).toBe("Alpha");
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

      expect(result.timesheets[0].team).toBe("Backend Core");
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
      expect(ts.team).toBe("Omega");
      expect(ts.ticketRef).toBe("ABC-42");
      expect(ts.taskCategory).toBe("Development");
      expect(ts.bookedHours).toBe(7.5);
      expect(ts.phase).toBe("Development");
    });
  });
});
