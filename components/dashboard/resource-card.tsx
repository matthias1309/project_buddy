"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StabilityBadge } from "@/components/shared/stability-badge";
import type { StabilityStatus } from "@/types/domain.types";

interface RoleRow {
  role: string;
  plannedHours: number;
  bookedHours: number;
  utilizationPct: number;
}

interface ResourceCardProps {
  byRole: RoleRow[];
  overallUtilizationPct: number;
  status: StabilityStatus;
  yellowThreshold: number;
  redThreshold: number;
}

function barColor(pct: number, yellow: number, red: number) {
  if (pct > red) return "#ef4444";
  if (pct > yellow) return "#eab308";
  return "#22c55e";
}

export function ResourceCard({
  byRole,
  overallUtilizationPct,
  status,
  yellowThreshold,
  redThreshold,
}: ResourceCardProps) {
  const chartData = byRole.map((r) => ({
    role: r.role,
    pct: Math.round(r.utilizationPct),
    fill: barColor(r.utilizationPct, yellowThreshold, redThreshold),
  }));

  const chartHeight = Math.max(byRole.length * 40 + 20, 80);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Ressourcen</CardTitle>
        <StabilityBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {overallUtilizationPct.toFixed(0)} %
          </span>
          <span className="text-xs text-muted-foreground">Gesamtauslastung</span>
        </div>

        {byRole.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Timesheet-Daten.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 32, top: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, Math.max(120, redThreshold + 20)]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                type="category"
                dataKey="role"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <ReferenceLine x={redThreshold} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine x={yellowThreshold} stroke="#eab308" strokeDasharray="3 3" />
              <Tooltip
                formatter={(value) => [`${value}%`, "Auslastung"]}
                cursor={{ fill: "transparent" }}
              />
              <Bar dataKey="pct" radius={3} label={{ position: "right", fontSize: 11, formatter: (v: unknown) => `${v}%` }}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            &lt; {yellowThreshold} %
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            {yellowThreshold}–{redThreshold} %
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            &gt; {redThreshold} %
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
