"use client";

import { MermaidBlock } from "@/components/MermaidBlock";
import { VisualAgentDataChart } from "@/components/VisualAgentDataChart";
import { isRechartsPayload } from "@/lib/agentVisualization";

interface ArchitectureDiagramProps {
  url: string;
  /** When set (e.g. Visual SQL Agent), render interactive Mermaid instead of a raster image. */
  mermaidSource?: string | null;
  /** Ask-agent chart saved as Recharts payload (same as portfolio languages chart). */
  recharts?: unknown;
}

export function ArchitectureDiagram({ url, mermaidSource, recharts }: ArchitectureDiagramProps) {
  if (recharts != null && isRechartsPayload(recharts)) {
    return <VisualAgentDataChart payload={recharts} />;
  }
  if (mermaidSource?.trim()) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Diagram</p>
        <MermaidBlock code={mermaidSource.trim()} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Architecture</p>
      <div className="rounded-md border border-border overflow-hidden bg-card">
        <img src={url} alt="Architecture diagram" className="w-full h-auto" />
      </div>
    </div>
  );
}
