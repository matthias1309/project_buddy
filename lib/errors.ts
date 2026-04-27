export const ERRORS = {
  AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
  AUTH_UNAUTHORIZED: "You are not authorised to perform this action.",
  PROJECT_NOT_FOUND: "Project not found.",
  PROJECT_ACCESS_DENIED: "You do not have access to this project.",
  IMPORT_FILE_TOO_LARGE: "File exceeds the 10 MB limit.",
  IMPORT_INVALID_FILE_TYPE: "Only .xlsx and .xls files are accepted.",
  IMPORT_PARSE_ERROR: "The file could not be parsed.",
  IMPORT_MISSING_REQUIRED_COLUMN: "A required column is missing.",
  THRESHOLD_INVALID_RANGE: "Red threshold must be stricter than yellow threshold.",
  PROJECT_INVALID_DATE: "Invalid date format (YYYY-MM-DD).",
  IMPORT_NETWORK_ERROR: "Network error — please try again.",
  SPRINT_NAME_REQUIRED: "Sprint name is required.",
  SPRINT_END_AFTER_START: "End date must be after start date.",
  SPRINT_NOT_FOUND: "Sprint not found.",
  GENERIC: "An unexpected error occurred. Please try again.",
} as const;

export type ErrorKey = keyof typeof ERRORS;
