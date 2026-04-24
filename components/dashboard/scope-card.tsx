"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StabilityBadge } from "@/components/shared/stability-badge";
import type { StabilityStatus } from "@/types/domain.types";

interface ScopeCardProps {
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPct: number;
  openIssues: number;
  totalIssues: number;
  bugRate: number;
  velocityTrend: number[];
  scopeGrowthPct: number;
  status: StabilityStatus;
}

export function ScopeCard({
  totalStoryPoints,
  completedStoryPoints,
  completionPct,
  openIssues,
  totalIssues,
  bugRate,
  velocityTrend,
  scopeGrowthPct,
  status,
}: ScopeCardProps) {
  const velocityData = velocityTrend.map((pts, i) => ({
    sprint: `S${i + 1}`,
    points: pts,
  }));

  const growthSign = scopeGrowthPct > 0 ? "+" : "";
  const growthColor =
    scopeGrowthPct > 0 ? "text-red-600" : "text-green-600";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Scope</CardTitle>
        <StabilityBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Story points progress */}
        <div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold">{completedStoryPoints}</span>
              <span className="text-muted-foreground"> / {totalStoryPoints} SP</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {completionPct.toFixed(0)} %
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(completionPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Offen</p>
            <p className="font-semibold">{openIssues}/{totalIssues}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bug-Rate</p>
            <p className="font-semibold">{bugRate.toFixed(1)} %</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Scope-Δ</p>
            <p className={`font-semibold ${growthColor}`}>
              {growthSign}{scopeGrowthPct.toFixed(1)} %
            </p>
          </div>
        </div>

        {/* Velocity mini chart */}
        {velocityData.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Velocity (letzte {velocityData.length} Sprints)
            </p>
            <ResponsiveContainer width="100%" height={64}>
              <LineChart data={velocityData} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                <XAxis
                  dataKey="sprint"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} SP`, "Velocity"]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="points"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6366f1" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
