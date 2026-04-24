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
import type { HoursByCategory } from "@/types/domain.types";

interface TimeByCategoryChartProps {
  data: HoursByCategory[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Development: "#6366f1",
  "Regular Meeting": "#f59e0b",
  Steuerung: "#10b981",
  Organization: "#8b5cf6",
};

function fmtHours(v: unknown): string {
  const n = Number(v);
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

export function TimeByCategoryChart({ data }: TimeByCategoryChartProps) {
  const chartHeight = Math.max(data.length * 44 + 20, 80);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 52, top: 0, bottom: 0 }}
      >
        <XAxis type="number" tickFormatter={(v) => `${v} h`} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: unknown) => [fmtHours(value), "Hours"]} cursor={{ fill: "transparent" }} />
        <Bar
          dataKey="hours"
          radius={3}
          label={{ position: "right", fontSize: 11, formatter: fmtHours }}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[entry.category] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
