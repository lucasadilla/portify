"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, type TooltipProps } from "recharts";

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

type CustomTooltipProps = TooltipProps<number, string>;

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const name = item.name ?? (item.payload as { name?: string })?.name ?? "";
  const value = item.value as number;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="font-medium text-foreground">{name}</div>
      <div className="text-muted-foreground">{value}%</div>
    </div>
  );
}

export function LanguageChart({ data, className }: LanguageChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!data.length) return null;
  const withColors = data.map((d, i) => ({ ...d, color: d.color ?? COLORS[i % COLORS.length] }));
  return (
    <div className={`min-w-0 w-full ${className ?? ""}`}>
      <h3 className="text-base font-medium mb-2">Languages</h3>
      <div className="h-[260px] w-full min-w-0 [&_.recharts-surface]:max-w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
            <Pie
              data={withColors}
              cx="50%"
              cy="48%"
              innerRadius="38%"
              outerRadius="60%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              onMouseLeave={() => setActiveIndex(null)}
            >
              {withColors.map((slice, i) => {
                const isActive = activeIndex === null || activeIndex === i;
                const opacity = activeIndex === null ? 0.9 : isActive ? 1 : 0.35;
                return (
                  <Cell
                    key={slice.name}
                    fill={slice.color}
                    fillOpacity={opacity}
                    stroke={slice.color}
                    strokeWidth={activeIndex === i ? 2 : 1}
                    onMouseEnter={() => setActiveIndex(i)}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              iconSize={14}
              wrapperStyle={{ fontSize: 13, width: "100%", color: "hsl(var(--muted-foreground))" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
