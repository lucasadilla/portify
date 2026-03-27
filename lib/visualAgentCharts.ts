import { isRechartsPayload, type RechartsPayload } from "@/lib/agentVisualization";

export type { RechartsPayload };

export type SavedVisualAgentChart = {
  id: string;
  question: string;
  title?: string;
  displayKind: "recharts" | "mermaid";
  recharts?: RechartsPayload | null;
  mermaidSource: string;
  insights: string;
  sql: string;
  url: string;
  createdAt: string;
};

export function parseVisualAgentChartsJson(json: string | null | undefined): SavedVisualAgentChart[] {
  if (!json?.trim()) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: SavedVisualAgentChart[] = [];
    for (const raw of arr) {
      const c = normalizeChart(raw);
      if (c) out.push(c);
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeChart(raw: unknown): SavedVisualAgentChart | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  if (typeof x.id !== "string") return null;

  const recharts = isRechartsPayload(x.recharts) ? x.recharts : null;
  const mermaidSource = typeof x.mermaidSource === "string" ? x.mermaidSource : "";
  const displayKind: "recharts" | "mermaid" = recharts ? "recharts" : "mermaid";

  return {
    id: x.id,
    question: typeof x.question === "string" ? x.question : "",
    title: typeof x.title === "string" ? x.title : undefined,
    displayKind,
    recharts: recharts ?? undefined,
    mermaidSource,
    insights: typeof x.insights === "string" ? x.insights : "",
    sql: typeof x.sql === "string" ? x.sql : "",
    url: typeof x.url === "string" ? x.url : "",
    createdAt: typeof x.createdAt === "string" ? x.createdAt : new Date().toISOString(),
  };
}
