"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { ProjectSprint } from "@/types/domain.types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SprintFilterProps {
  sprints: Pick<ProjectSprint, "id" | "name" | "start_date" | "end_date">[];
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function SprintFilter({ sprints }: SprintFilterProps) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const selectedSprints = searchParams.getAll("sprint");

  const toggle = useCallback(
    (name: string, checked: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("sprint");
      const next = checked
        ? [...selectedSprints, name]
        : selectedSprints.filter((s) => s !== name);
      next.forEach((s) => params.append("sprint", s));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, selectedSprints],
  );

  if (sprints.length === 0) return null;

  const label =
    selectedSprints.length === 0
      ? "All sprints"
      : selectedSprints.length === 1
        ? selectedSprints[0]
        : `${selectedSprints.length} sprints`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Sprint</span>
      <Popover>
        <PopoverTrigger
          className="inline-flex h-8 max-w-[240px] items-center truncate rounded-md border border-input bg-background px-3 text-left text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          {label}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-3">
          <div className="space-y-2">
            {selectedSprints.length > 0 && (
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("sprint");
                  router.push(`${pathname}?${params.toString()}`);
                }}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear selection
              </button>
            )}
            {sprints.map((sprint) => {
              const checked = selectedSprints.includes(sprint.name);
              return (
                <div key={sprint.id} className="flex items-start gap-3">
                  <Checkbox
                    id={`sprint-${sprint.id}`}
                    checked={checked}
                    onCheckedChange={(v: boolean | "indeterminate") => toggle(sprint.name, v === true)}
                  />
                  <Label
                    htmlFor={`sprint-${sprint.id}`}
                    className="cursor-pointer leading-tight"
                  >
                    <span className="block text-sm">{sprint.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatShortDate(sprint.start_date)} –{" "}
                      {formatShortDate(sprint.end_date)}
                    </span>
                  </Label>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
