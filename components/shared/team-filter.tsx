"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TeamFilterProps {
  teams: string[];
}

export function TeamFilter({ teams }: TeamFilterProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const selectedTeams = searchParams.getAll("team");

  const toggle = useCallback(
    (name: string, checked: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("team");
      const next = checked
        ? [...selectedTeams, name]
        : selectedTeams.filter((t) => t !== name);
      next.forEach((t) => params.append("team", t));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, selectedTeams],
  );

  if (teams.length === 0) return null;

  const label =
    selectedTeams.length === 0
      ? "All teams"
      : selectedTeams.length === 1
        ? selectedTeams[0]
        : `${selectedTeams.length} teams`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Team</span>
      <Popover>
        <PopoverTrigger
          className="inline-flex h-8 max-w-[240px] items-center truncate rounded-md border border-input bg-background px-3 text-left text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          {label}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="space-y-2">
            {selectedTeams.length > 0 && (
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("team");
                  router.push(`${pathname}?${params.toString()}`);
                }}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear selection
              </button>
            )}
            {teams.map((team) => {
              const checked = selectedTeams.includes(team);
              return (
                <div key={team} className="flex items-center gap-3">
                  <Checkbox
                    id={`team-${team}`}
                    checked={checked}
                    onCheckedChange={(v: boolean | "indeterminate") =>
                      toggle(team, v === true)
                    }
                  />
                  <Label
                    htmlFor={`team-${team}`}
                    className="cursor-pointer text-sm"
                  >
                    {team}
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
