import * as XLSX from "xlsx";
import { resolve } from "path";
import { mkdirSync } from "fs";

const fixtureDir = resolve(__dirname, ".");
mkdirSync(fixtureDir, { recursive: true });

// --- Shared data ---

const ISSUES_EN = [
  {
    "Issue Key": "PROJ-1",
    Summary: "Setup project structure",
    "Issue Type": "Task",
    Status: "Done",
    "Story Points": 3,
    Sprint: "Sprint 1",
    "Epic Link": "PROJ-E1",
    Assignee: "Alice",
    Created: "2024-01-05",
    Resolved: "2024-01-10",
  },
  {
    "Issue Key": "PROJ-2",
    Summary: "Implement login",
    "Issue Type": "Story",
    Status: "Done",
    "Story Points": 5,
    Sprint: "Sprint 1",
    "Epic Link": "PROJ-E1",
    Assignee: "Bob",
    Created: "2024-01-05",
    Resolved: "2024-01-12",
  },
  {
    "Issue Key": "PROJ-3",
    Summary: "Create dashboard",
    "Issue Type": "Story",
    Status: "In Progress",
    "Story Points": 8,
    Sprint: "Sprint 2",
    "Epic Link": "PROJ-E2",
    Assignee: "Alice",
    Created: "2024-01-15",
    Resolved: "",
  },
  {
    "Issue Key": "PROJ-4",
    Summary: "Fix login bug",
    "Issue Type": "Bug",
    Status: "In Progress",
    "Story Points": 2,
    Sprint: "Sprint 2",
    "Epic Link": "PROJ-E1",
    Assignee: "Bob",
    Created: "2024-01-16",
    Resolved: "",
  },
  {
    "Issue Key": "PROJ-5",
    Summary: "Write tests",
    "Issue Type": "Task",
    Status: "To Do",
    "Story Points": 3,
    Sprint: "Sprint 2",
    "Epic Link": "PROJ-E2",
    Assignee: "Charlie",
    Created: "2024-01-17",
    Resolved: "",
  },
];

const SPRINTS_EN = [
  {
    "Sprint Name": "Sprint 1",
    State: "closed",
    "Start Date": "2024-01-05",
    "End Date": "2024-01-14",
    "Completed Points": 8,
    "Planned Points": 8,
  },
  {
    "Sprint Name": "Sprint 2",
    State: "active",
    "Start Date": "2024-01-15",
    "End Date": "2024-01-28",
    "Completed Points": 0,
    "Planned Points": 13,
  },
];

// --- jira-sample.xlsx ---

function writeJiraSample() {
  const wb = XLSX.utils.book_new();
  const wsIssues = XLSX.utils.json_to_sheet(ISSUES_EN);
  XLSX.utils.book_append_sheet(wb, wsIssues, "Issues");
  const wsSprints = XLSX.utils.json_to_sheet(SPRINTS_EN);
  XLSX.utils.book_append_sheet(wb, wsSprints, "Sprints");
  XLSX.writeFile(wb, resolve(fixtureDir, "jira-sample.xlsx"));
  console.log("✓ jira-sample.xlsx");
}

// --- jira-german-columns.xlsx ---

const ISSUES_DE = ISSUES_EN.map((issue) => ({
  Vorgangsschlüssel: issue["Issue Key"],
  Zusammenfassung: issue.Summary,
  Vorgangstyp: issue["Issue Type"],
  Status: issue.Status,
  "Story Points": issue["Story Points"],
  Sprint: issue.Sprint,
  "Epic-Link": issue["Epic Link"],
  "Zugewiesene Person": issue.Assignee,
  Erstellt: issue.Created,
  Gelöst: issue.Resolved,
}));

const SPRINTS_DE = SPRINTS_EN.map((sprint) => ({
  "Sprint-Name": sprint["Sprint Name"],
  Zustand: sprint.State,
  Startdatum: sprint["Start Date"],
  Enddatum: sprint["End Date"],
  "Fertige Punkte": sprint["Completed Points"],
  "Geplante Punkte": sprint["Planned Points"],
}));

function writeJiraGermanColumns() {
  const wb = XLSX.utils.book_new();
  const wsIssues = XLSX.utils.json_to_sheet(ISSUES_DE);
  XLSX.utils.book_append_sheet(wb, wsIssues, "Issues");
  const wsSprints = XLSX.utils.json_to_sheet(SPRINTS_DE);
  XLSX.utils.book_append_sheet(wb, wsSprints, "Sprints");
  XLSX.writeFile(wb, resolve(fixtureDir, "jira-german-columns.xlsx"));
  console.log("✓ jira-german-columns.xlsx");
}

// --- jira-missing-key.xlsx ---
// Row 3 (second data row) has no Issue Key

function writeJiraMissingKey() {
  const issues = ISSUES_EN.map((issue, idx) => ({
    ...issue,
    "Issue Key": idx === 1 ? "" : issue["Issue Key"], // idx=1 → second data row = Excel row 3
  }));
  const wb = XLSX.utils.book_new();
  const wsIssues = XLSX.utils.json_to_sheet(issues);
  XLSX.utils.book_append_sheet(wb, wsIssues, "Issues");
  const wsSprints = XLSX.utils.json_to_sheet(SPRINTS_EN);
  XLSX.utils.book_append_sheet(wb, wsSprints, "Sprints");
  XLSX.writeFile(wb, resolve(fixtureDir, "jira-missing-key.xlsx"));
  console.log("✓ jira-missing-key.xlsx");
}

// --- openair-sample.xlsx ---

const TIMESHEETS_DE = [
  { Mitarbeiter: "Anna Müller", Rolle: "Senior Consultant", Phase: "Analyse", "Geplante Stunden": 40, "Gebuchte Stunden": 38, Datum: "2024-01-31" },
  { Mitarbeiter: "Anna Müller", Rolle: "Senior Consultant", Phase: "Design", "Geplante Stunden": 60, "Gebuchte Stunden": 55, Datum: "2024-02-29" },
  { Mitarbeiter: "Ben Schmidt", Rolle: "Consultant", Phase: "Analyse", "Geplante Stunden": 40, "Gebuchte Stunden": 42, Datum: "2024-01-31" },
  { Mitarbeiter: "Ben Schmidt", Rolle: "Consultant", Phase: "Design", "Geplante Stunden": 60, "Gebuchte Stunden": 50, Datum: "2024-02-29" },
  { Mitarbeiter: "Chris Weber", Rolle: "Projektleiter", Phase: "Analyse", "Geplante Stunden": 20, "Gebuchte Stunden": 22, Datum: "2024-01-31" },
  { Mitarbeiter: "Chris Weber", Rolle: "Projektleiter", Phase: "Design", "Geplante Stunden": 20, "Gebuchte Stunden": 18, Datum: "2024-02-29" },
  { Mitarbeiter: "Dana Klein", Rolle: "Consultant", Phase: "Implementierung", "Geplante Stunden": 80, "Gebuchte Stunden": 65, Datum: "2024-03-31" },
  { Mitarbeiter: "Anna Müller", Rolle: "Senior Consultant", Phase: "Implementierung", "Geplante Stunden": 80, "Gebuchte Stunden": 90, Datum: "2024-03-31" },
];

const BUDGET_DE = [
  { Kategorie: "Personal", "Geplant (EUR)": 120000, "Ist (EUR)": 98000, Periode: "2024-03-31" },
  { Kategorie: "Reise", "Geplant (EUR)": 5000, "Ist (EUR)": 3200, Periode: "2024-03-31" },
  { Kategorie: "Lizenzen", "Geplant (EUR)": 8000, "Ist (EUR)": 8000, Periode: "2024-03-31" },
  { Kategorie: "Sonstiges", "Geplant (EUR)": 2000, "Ist (EUR)": 800, Periode: "2024-03-31" },
];

const MILESTONES_DE = [
  { Name: "Kick-off", Geplant: "2024-01-05", Aktuell: "2024-01-05", Status: "completed" },
  { Name: "Design-Abnahme", Geplant: "2024-02-15", Aktuell: "2024-02-15", Status: "completed" },
  { Name: "Go-Live", Geplant: "2024-04-01", Aktuell: "2024-04-15", Status: "delayed" },
];

function writeOpenAirSample() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(TIMESHEETS_DE), "Timesheets");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(BUDGET_DE), "Budget");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(MILESTONES_DE), "Meilensteine");
  XLSX.writeFile(wb, resolve(fixtureDir, "openair-sample.xlsx"));
  console.log("✓ openair-sample.xlsx");
}

// --- openair-partial.xlsx (no Budget sheet) ---

function writeOpenAirPartial() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(TIMESHEETS_DE), "Timesheets");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(MILESTONES_DE), "Meilensteine");
  XLSX.writeFile(wb, resolve(fixtureDir, "openair-partial.xlsx"));
  console.log("✓ openair-partial.xlsx");
}

// --- Run ---

writeJiraSample();
writeJiraGermanColumns();
writeJiraMissingKey();
writeOpenAirSample();
writeOpenAirPartial();

console.log("\nAll fixtures generated successfully.");
