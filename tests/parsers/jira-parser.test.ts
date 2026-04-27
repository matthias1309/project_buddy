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
      // 5 story/task/bug rows + 2 epic rows added for FEAT-011
      expect(result.issues).toHaveLength(7);

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

    it("should parse tShirtDays from Epic rows in jira-sample.xlsx", () => {
      const buf = fixture("jira-sample.xlsx");
      const result = parseJiraExcel(buf);

      const epic1 = result.issues.find((i) => i.issueKey === "PROJ-E1");
      const epic2 = result.issues.find((i) => i.issueKey === "PROJ-E2");

      expect(epic1).toBeDefined();
      expect(epic1!.tShirtDays).toBe(10);

      expect(epic2).toBeDefined();
      expect(epic2!.tShirtDays).toBeNull(); // empty T-Shirt cell

      // Non-epic rows must not carry tShirtDays
      const story = result.issues.find((i) => i.issueKey === "PROJ-1");
      expect(story!.tShirtDays).toBeUndefined();
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

    it("should return undefined storyPoints for a non-numeric value", () => {
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1", Status: "Done", "Story Points": "not-a-number" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].storyPoints).toBeUndefined();
    });

    it("should return undefined createdDate for an invalid date string", () => {
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1", Status: "Done", Created: "not-a-date" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].createdDate).toBeUndefined();
    });

    it("should return undefined createdDate when cell value is a plain number", () => {
      // A plain number without date format hits the non-string truthy branch in cellDate
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["Issue Key", "Status", "Created"],
          ["PROJ-1", "Done", 42],
        ]),
        "Issues",
      );
      const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      const result = parseJiraExcel(buf);

      expect(result.issues[0].createdDate).toBeUndefined();
    });

    it("should parse Date objects written to xlsx (instanceof Date branch)", () => {
      // json_to_sheet with a JS Date writes a date-formatted cell;
      // XLSX.read with cellDates:true reads it back as a Date object
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1", Status: "Done", Created: new Date("2024-01-15") },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].createdDate).toBeInstanceOf(Date);
    });

    it("should map empty optional issue string fields to undefined", () => {
      // Covers the `|| undefined` fallback for summary, sprint, epic, assignee
      const buf = buildBuffer([
        {
          "Issue Key": "PROJ-1",
          Status: "Done",
          Summary: "",
          Sprint: "",
          "Epic Link": "",
          Assignee: "",
        },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].summary).toBeUndefined();
      expect(result.issues[0].sprint).toBeUndefined();
      expect(result.issues[0].epic).toBeUndefined();
      expect(result.issues[0].assignee).toBeUndefined();
    });

    it("should generate errors for all rows when no Issue Key column exists", () => {
      // colIssueKey = -1 → issueKey = "" for every row → error for each
      const buf = buildBuffer([{ Status: "Done", Summary: "No key column" }]);
      const result = parseJiraExcel(buf);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.issues).toHaveLength(0);
    });

    it("should fall back to the first sheet when no sheet name matches /issue|jira/", () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ "Issue Key": "PROJ-1", Status: "Done" }]),
        "Data Export",
      );
      const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      const result = parseJiraExcel(buf);

      expect(result.issues).toHaveLength(1);
    });

    it("should handle a sprints sheet with only the Sprint Name column", () => {
      // colState/colStart/colEnd/colCompleted/colPlanned all = -1
      const buf = buildBuffer(
        [{ "Issue Key": "PROJ-1", Status: "Done" }],
        [{ "Sprint Name": "Sprint 1" }],
      );
      const result = parseJiraExcel(buf);

      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].state).toBeUndefined();
      expect(result.sprints[0].startDate).toBeUndefined();
      expect(result.sprints[0].plannedPoints).toBeUndefined();
    });

    it("should map an empty Sprint State cell to undefined", () => {
      // cellString(row[colState]) returns "" → `|| undefined` kicks in
      const buf = buildBuffer(
        [{ "Issue Key": "PROJ-1", Status: "Done" }],
        [{ "Sprint Name": "Sprint 1", State: "" }],
      );
      const result = parseJiraExcel(buf);

      expect(result.sprints[0].state).toBeUndefined();
    });

    it("should skip a sprint row when the Sprint Name cell is empty", () => {
      const buf = buildBuffer(
        [{ "Issue Key": "PROJ-1", Status: "Done" }],
        [
          { "Sprint Name": "Sprint 1" },
          { "Sprint Name": "" },
        ],
      );
      const result = parseJiraExcel(buf);

      expect(result.sprints).toHaveLength(1);
    });

    it("should skip all sprint rows when no Sprint Name column is present", () => {
      // colName = -1 → sprintName = "" for all rows → all skipped
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ "Issue Key": "PROJ-1", Status: "Done" }]),
        "Issues",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([{ Foo: "bar" }]),
        "Sprints",
      );
      const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      const result = parseJiraExcel(buf);

      expect(result.sprints).toHaveLength(0);
    });
  });

  describe("T-Shirt size parsing", () => {
    it("should parse a numeric T-Shirt value on an Epic row", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "Epic", "T-Shirt": "25" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.errors).toHaveLength(0);
      expect(result.issues[0].tShirtDays).toBe(25);
    });

    it("should return null tShirtDays for a non-numeric T-Shirt value on an Epic", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "Epic", "T-Shirt": "abc" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBeNull();
    });

    it("should return null tShirtDays when the T-Shirt cell is empty on an Epic", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "Epic", "T-Shirt": "" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBeNull();
    });

    it("should not set tShirtDays on non-Epic rows (Story)", () => {
      const buf = buildBuffer([
        { "Issue Key": "PROJ-1", Status: "Done", "Issue Type": "Story", "T-Shirt": "10" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBeUndefined();
    });

    it("should recognise 'tshirt' as a column alias", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "Epic", tshirt: "5" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBe(5);
    });

    it("should recognise 't shirt' (with space) as a column alias", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "Epic", "t shirt": "8" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBe(8);
    });

    it("should parse T-Shirt when Excel auto-corrects the hyphen to an en-dash (T–Shirt)", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "Epic", "T–Shirt": "20" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBe(20);
    });

    it("should set tShirtDays regardless of Issue Type capitalisation (e.g. 'EPIC')", () => {
      const buf = buildBuffer([
        { "Issue Key": "EPIC-1", Status: "In Progress", "Issue Type": "EPIC", "T-Shirt": "15" },
      ]);
      const result = parseJiraExcel(buf);

      expect(result.issues[0].tShirtDays).toBe(15);
    });
  });
});
