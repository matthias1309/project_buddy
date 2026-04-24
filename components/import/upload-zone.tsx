"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ERRORS } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import type { ParseError } from "@/types/domain.types";

interface UploadZoneProps {
  source: "jira" | "openair";
  projectId: string;
  label: string;
  description?: string;
}

type UploadState =
  | { type: "idle" }
  | { type: "uploading" }
  | { type: "success"; recordsImported: number; warnings: string[] }
  | { type: "error"; message: string; parseErrors?: ParseError[] };

export function UploadZone({
  source,
  projectId,
  label,
  description,
}: UploadZoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ type: "idle" });
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setState({ type: "uploading" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);

    try {
      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setState({
          type: "error",
          message: json.message ?? "Upload failed",
        });
        return;
      }

      setState({
        type: "success",
        recordsImported: json.recordsImported,
        warnings: json.warnings ?? [],
      });
      router.refresh();
    } catch {
      setState({ type: "error", message: ERRORS.IMPORT_NETWORK_ERROR });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {state.type !== "idle" && state.type !== "uploading" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState({ type: "idle" })}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          state.type === "uploading" ? "pointer-events-none opacity-60" : "",
        ]
          .join(" ")
          .trim()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        {state.type === "idle" && (
          <>
            <UploadIcon />
            <p className="text-sm text-muted-foreground">
              Drag &amp; drop or{" "}
              <span className="text-primary font-medium">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">.xlsx / .xls · max 10 MB</p>
          </>
        )}

        {state.type === "uploading" && (
          <p className="text-sm text-muted-foreground animate-pulse">
            Uploading…
          </p>
        )}

        {state.type === "success" && (
          <div className="flex flex-col items-center gap-1 text-center">
            <CheckIcon className="text-green-600" />
            <p className="text-sm font-medium text-green-700">
              {state.recordsImported} records imported
            </p>
            {state.warnings.length > 0 && (
              <ul className="mt-1 text-xs text-amber-600 list-disc list-inside text-left">
                {state.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {state.type === "error" && (
          <div className="flex flex-col items-center gap-1 text-center">
            <ErrorIcon className="text-red-500" />
            <p className="text-sm font-medium text-red-700">{state.message}</p>
            {state.parseErrors && state.parseErrors.length > 0 && (
              <ul className="mt-1 text-xs text-red-600 list-disc list-inside text-left max-h-32 overflow-y-auto">
                {state.parseErrors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-8 w-8 text-muted-foreground/50"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-8 w-8 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-8 w-8 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}
