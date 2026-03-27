"use client";

import { LanguageChart, type LanguageSlice } from "@/components/LanguageChart";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import type { RechartsPayload } from "@/lib/agentVisualization";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  payload: RechartsPayload;
  className?: string;
}

export function VisualAgentDataChart({ payload, className }: Props) {
  if (payload.variant === "pie") {
    const data: LanguageSlice[] = payload.data.map((d) => ({ name: d.name, value: d.value }));
    return (
      <div className={className}>
        <LanguageChart data={data} heading={null} />
      </div>
    );
  }

  if (payload.variant === "line") {
    const evolutionData = payload.data.map((d) => ({
      month: d.month,
      commits: d.value,
    }));
    return (
      <div className={className}>
        <EvolutionGraph data={evolutionData} heading={null} />
      </div>
    );
  }

  return (
    <div className={`h-[260px] w-full min-w-0 ${className ?? ""}`}>
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={payload.data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" interval={0} angle={-25} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" width={36} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              formatter={(value: number) => [value, ""]}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
