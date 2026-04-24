import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseJiraExcel } from "@/lib/parsers/jira-parser";

function fixture(name: string): Buffer {
  return readFileSync(resolve(__dirname, "../fixtures", name));
}

function buildBuffer(
  issues: Record<string, unknown>[],
  sprints: Record<string, unknown>[] = [],
): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issues), "Issues");
  if (sprints.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sprints), "Sprints");
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("jiraParser", () => {
  describe("parseJiraExcel", () => {
    it("should map standard English Jira columns correctly", () => {
      const buf = fixture("jira-sample.xlsx");
      const result = parseJiraExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.issues).toHaveLength(5);

      const first = result.issues[0];
      expect(first.issueKey).toBe("PROJ-1");
      expect(first.summary).toBe("Setup project structure");
      expect(first.issueType).toBe("Task");
      expect(first.status).toBe("Done");
      expect(first.storyPoints).toBe(3);
      expect(first.sprint).toBe("Sprint 1");
      expect(first.epic).toBe("PROJ-E1");
      expect(first.assignee).toBe("Alice");
    });

    it("should parse sprint data from Sprints sheet", () => {
      const buf = fixture("jira-sample.xlsx");
      const result = parseJiraExcel(buf);

      expect(result.sprints).toHaveLength(2);

      const sprint1 = result.sprints[0];
      expect(sprint1.sprintName).toBe("Sprint 1");
      expect(sprint1.state).toBe("closed");
      expect(sprint1.completedPoints).toBe(8);
      expect(sprint1.plannedPoints).toBe(8);
    });

    it("should recognise German column names", () => {
      const buf = fixture("jira-german-columns.xlsx");
      const result = parseJiraExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.issues).toHaveLength(5);

      const first = result.issues[0];
      expect(first.issueKey).toBe("PROJ-1");
      expect(first.summary).toBe("Setup project structure");
      expect(first.issueType).toBe("Task");
      expect(first.status).toBe("Done");
      expect(first.assignee).toBe("Alice");
    });

    it("should return a ParseError with the correct row number when Issue Key is missing", () => {
      const buf = fixture("jira-missing-key.xlsx");
      const result = parseJiraExcel(buf);

      const keyErrors = result.errors.filter((e) =>
        e.message.toLowerCase().includes("issue key"),
      );
      expect(keyErrors).toHaveLength(1);
      expect(keyErrors[0].row).toBe(3); // header=row1, first data=row2, second data=row3
    });

    it("should import remaining valid issues even when one row has a missing key", () => {
      const buf = fixture("jira-missing-key.xlsx");
      const result = parseJiraExcel(buf);

      // 5 total rows, 1 with missing key → 4 valid issues
      expect(result.issues).toHaveLength(4);
    });

    it("should ignore unknown columns without error", () => {
      const buf = buildBuffer([
        {
          "Issue Key": "PROJ-1",
          Status: "Done",
          "Unknown Column": "some value",
          "Another Unknown": 42,
        },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].issueKey).toBe("PROJ-1");
    });

    it("should skip empty rows without error", () => {
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1", Status: "Done" },
        { "Issue Key": "", Status: "", Summary: "" }, // fully empty row
        { "Issue Key": "PROJ-2", Status: "In Progress" },
      ]);
      const result = parseJiraExcel(buf);

      // The empty row should be silently skipped
      expect(result.issues).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should return errors for missing Status field", () => {
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1" }, // no Status column at all
      ]);
      const result = parseJiraExcel(buf);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message.toLowerCase()).toContain("status");
    });

    it("should handle a file with no issues gracefully", () => {
      const buf = buildBuffer([]);
      const result = parseJiraExcel(buf);

      expect(result.issues).toHaveLength(0);
      expect(result.sprints).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should recognise 'Story point estimate' as an alias for Story Points", () => {
      const buf = buildBuffer([
        {
          "Issue Key": "PROJ-1",
          Status: "Done",
          "Story point estimate": 8,
        },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].storyPoints).toBe(8);
    });

    it("should recognise 'Key' as an alias for Issue Key", () => {
      const buf = buildBuffer([
        { Key: "PROJ-X", Status: "To Do" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.issues[0].issueKey).toBe("PROJ-X");
    });

    it("should treat storyPoints as undefined when the cell is empty", () => {
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1", Status: "Done", "Story Points": "" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].storyPoints).toBeUndefined();
    });
  });
});
