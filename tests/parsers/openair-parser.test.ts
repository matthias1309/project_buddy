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
});
