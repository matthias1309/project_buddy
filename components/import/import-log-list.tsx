import type { Database } from "@/types/database.types";

type ImportLog = Database["public"]["Tables"]["import_logs"]["Row"];

interface ImportLogListProps {
  logs: ImportLog[];
}

const SOURCE_LABEL: Record<string, string> = {
  jira: "Jira",
  openair: "OpenAir",
};

const STATUS_STYLES: Record<string, string> = {
  success: "text-green-700 bg-green-50",
  partial: "text-amber-700 bg-amber-50",
  error: "text-red-700 bg-red-50",
};

export function ImportLogList({ logs }: ImportLogListProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No imports yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[log.status] ?? "text-muted-foreground bg-muted"}`}
            >
              {log.status}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{log.filename}</p>
              <p className="text-xs text-muted-foreground">
                {SOURCE_LABEL[log.source] ?? log.source}
                {log.records_imported != null &&
                  ` · ${log.records_imported} records`}
              </p>
            </div>
          </div>
          <time
            dateTime={log.imported_at}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {new Date(log.imported_at).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </li>
      ))}
    </ul>
  );
}
