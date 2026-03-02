"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface EvolutionDataPoint {
  month: string;
  commits: number; // contribution count (commits + other activity) per month
}

interface EvolutionGraphProps {
  data: EvolutionDataPoint[];
  className?: string;
}

function formatMonth(label: string): string {
  const [y, m] = label.split("-");
  if (!y || !m) return label;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[parseInt(m, 10) - 1] ?? m;
  return `${monthName} ${y}`;
}

export function EvolutionGraph({ data, className }: EvolutionGraphProps) {
  if (!data.length) {
    return (
      <div className={className}>
        <h3 className="text-sm font-medium mb-2">Contributions over time</h3>
        <p className="text-sm text-muted-foreground">No contribution data available.</p>
      </div>
    );
  }
  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2">Contributions over time</h3>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickFormatter={formatMonth}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              allowDecimals={false}
              width={28}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              labelFormatter={formatMonth}
              formatter={(value: number) => [value, "contributions"]}
            />
            <Line
              type="monotone"
              dataKey="commits"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
