"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { HoursByTeam } from "@/types/domain.types";

interface TimeByTeamChartProps {
  data: HoursByTeam[];
}

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5"];

function fmtHours(v: unknown): string {
  const n = Number(v);
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

export function TimeByTeamChart({ data }: TimeByTeamChartProps) {
  const chartHeight = Math.max(data.length * 44 + 20, 80);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 52, top: 0, bottom: 0 }}
      >
        <XAxis type="number" tickFormatter={(v) => `${v} h`} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="team" width={110} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: unknown) => [fmtHours(value), "Hours"]} cursor={{ fill: "transparent" }} />
        <Bar
          dataKey="hours"
          radius={3}
          label={{ position: "right", fontSize: 11, formatter: fmtHours }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
