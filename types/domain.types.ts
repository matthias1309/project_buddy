// --- Parse types ---

export interface ParseError {
  row: number;
  message: string;
}

// --- Jira ---

export interface JiraIssue {
  issueKey: string;
  summary?: string;
  issueType?: string;
  status: string;
  storyPoints?: number;
  sprint?: string;
  epic?: string;
  assignee?: string;
  createdDate?: Date;
  resolvedDate?: Date;
}

export interface JiraSprint {
  sprintName: string;
  state?: string;
  startDate?: Date;
  endDate?: Date;
  completedPoints?: number;
  plannedPoints?: number;
}

export interface JiraParseResult {
  issues: JiraIssue[];
  sprints: JiraSprint[];
  errors: ParseError[];
  warnings: string[];
}

// --- OpenAir ---

export interface OATimesheet {
  employeeName?: string;
  role?: string;
  phase?: string;
  plannedHours?: number;
  bookedHours?: number;
  periodDate?: Date;
}

export interface OAMilestone {
  name: string;
  plannedDate?: Date;
  actualDate?: Date;
  status?: string;
}

export interface OABudgetEntry {
  category?: string;
  plannedEur?: number;
  actualEur?: number;
  periodDate?: Date;
}

export interface OpenAirParseResult {
  timesheets: OATimesheet[];
  milestones: OAMilestone[];
  budgetEntries: OABudgetEntry[];
  errors: ParseError[];
  warnings: string[];
}

// --- KPIs ---

export interface BudgetKPIs {
  plannedEur: number;
  actualEur: number;
  differenceEur: number;
  differencePct: number;
  burnRate: number;
  eac: number;
}

export interface ScheduleKPIs {
  totalMilestones: number;
  delayedMilestones: number;
  maxDelayDays: number;
  nextMilestone: OAMilestone | null;
}

export interface ResourceKPIByRole {
  role: string;
  plannedHours: number;
  bookedHours: number;
  utilizationPct: number;
}

export interface ResourceKPIs {
  byRole: ResourceKPIByRole[];
  overallUtilizationPct: number;
}

export interface ScopeKPIs {
  totalIssues: number;
  openIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPct: number;
  velocityTrend: number[];
  bugRate: number;
  /** Growth of total story points relative to the sum of sprint planned points. 0 when no sprint baseline exists. */
  scopeGrowthPct: number;
}

// --- Stability ---

export type StabilityStatus = "green" | "yellow" | "red";

export type StabilityDimension = "budget" | "schedule" | "resource" | "scope";

export interface DimensionResult {
  dimension: StabilityDimension;
  status: StabilityStatus;
  value: number;
  threshold: { yellow: number; red: number };
}

export interface StabilityResult {
  status: StabilityStatus;
  score: number;
  dimensions: DimensionResult[];
}

// --- Project thresholds ---

export interface ProjectThresholds {
  budgetYellowPct: number;
  budgetRedPct: number;
  scheduleYellowDays: number;
  scheduleRedDays: number;
  resourceYellowPct: number;
  resourceRedPct: number;
  scopeYellowPct: number;
  scopeRedPct: number;
}
