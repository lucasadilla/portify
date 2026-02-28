"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface LanguageSlice {
  name: string;
  value: number;
  color?: string;
}

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#06b6d4", "#f97316"];

interface LanguageChartProps {
  data: LanguageSlice[];
  className?: string;
}

export function LanguageChart({ data, className }: LanguageChartProps) {
  if (!data.length) return null;
  const withColors = data.map((d, i) => ({ ...d, color: d.color ?? COLORS[i % COLORS.length] }));
  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2">Languages</h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={withColors}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {withColors.map((_, i) => (
                <Cell key={i} fill={withColors[i].color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              formatter={(value: number) => [value, "Bytes"]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
