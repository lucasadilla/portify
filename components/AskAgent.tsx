"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import mermaid from "mermaid";
import { MermaidBlock } from "@/components/MermaidBlock";
import { VisualAgentDataChart } from "@/components/VisualAgentDataChart";
import type { RechartsPayload } from "@/lib/agentVisualization";

const PLACEHOLDER_SVG_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="100%" height="100%" fill="%231a1a1a" rx="8"/></svg>'
)}`;

const EXAMPLES = [
  "Which repos are least active by last commit date?",
  "What are my top languages by rough weight?",
  "Show months with the most commit activity.",
  "Compare total additions vs deletions across repos.",
];

type AgentResponse = {
  ok: true;
  question: string;
  title: string;
  sql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  insights: string;
  recharts: RechartsPayload | null;
  mermaid: string;
  dataSource?: "github_live" | "github_cached";
  /** Where repo rows (counts, created_at) came from for profile questions */
  githubRepoSource?: "github_list" | "github_first_page" | "github_per_repo" | "portfolio_only" | null;
};

type Props = {
  scope: "repo" | "profile";
  portfolioSlug: string;
  portfolioRepoId?: string;
  portfolioId?: string | null;
  onSaved?: () => void;
};

export function AskAgent({ scope, portfolioSlug, portfolioRepoId, portfolioId, onSaved }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (result?.title) setTitleDraft(result.title);
  }, [result?.title]);

  async function run() {
    setError(null);
    setResult(null);
    const q = question.trim();
    if (q.length < 3) {
      setError("Please enter a question (at least 3 characters).");
      return;
    }
    setLoading(true);
    try {
      const url = new URL("/api/ask-agent", typeof window !== "undefined" ? window.location.origin : "http://localhost").toString();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          scope,
          portfolioRepoId: scope === "repo" ? portfolioRepoId : undefined,
          portfolioSlug: scope === "profile" ? portfolioSlug : undefined,
        }),
        credentials: "same-origin",
      });
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setError(res.status === 404 ? "API route missing — restart dev server (npm run dev)." : `Request failed (${res.status})`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.ok) {
        const r = data as AgentResponse;
        setResult(r);
        setTitleDraft(r.title ?? "");
      } else setError(data.error ?? "Unknown error");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveAsDiagram() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const title = titleDraft.trim() || result.title || "Chart";

      if (scope === "repo") {
        if (!portfolioRepoId) {
          setError("Missing project id.");
          return;
        }
        let url: string;
        if (result.recharts) {
          url = PLACEHOLDER_SVG_DATA_URL;
        } else {
          mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "dark" });
          const { svg } = await mermaid.render(`save-${Date.now()}`, result.mermaid);
          url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
        const metadata = {
          diagramKind: "visual-agent",
          title,
          description: result.question.slice(0, 4000),
          mermaidSource: result.mermaid || undefined,
          recharts: result.recharts ?? undefined,
          question: result.question,
          sql: result.sql,
        };
        const res = await fetch(`/api/portfolio/repos/${portfolioRepoId}/artifacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "diagram", url, metadata }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError((e as { error?: string }).error ?? "Could not save diagram");
          return;
        }
      } else {
        if (!portfolioId) {
          setError("Missing portfolio id.");
          return;
        }
        let url = "";
        if (!result.recharts && result.mermaid) {
          mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "dark" });
          const { svg } = await mermaid.render(`save-${Date.now()}`, result.mermaid);
          url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        }
        const res = await fetch(`/api/portfolio/visual-agent-charts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            question: result.question,
            title,
            recharts: result.recharts,
            mermaidSource: result.mermaid || "",
            insights: result.insights,
            sql: result.sql,
            url,
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError((e as { error?: string }).error ?? "Could not save chart");
          return;
        }
      }
      onSaved?.();
    } catch {
      setError("Could not render or save chart");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Ask your GitHub data
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Each question loads data from GitHub when you&apos;re signed in. Numeric data uses the same charts as
          languages and contributions; other answers use a diagram. Saved items appear in the charts section.
          Repo timelines use each repository&apos;s creation date on GitHub when the full list loads (not only
          projects generated in Portify).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="text-[10px] rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setQuestion(ex)}
            >
              {ex.length > 42 ? `${ex.slice(0, 40)}…` : ex}
            </button>
          ))}
        </div>
        <div>
          <Label className="text-xs">Your question</Label>
          <textarea
            className="mt-1 w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. "Which repos had the most activity last year?"'
            maxLength={600}
          />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Querying GitHub…" : "Generate chart"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <Label className="text-xs">Chart title</Label>
              <Input
                className="mt-1"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="Title"
                maxLength={120}
              />
            </div>
            {scope === "profile" && result.githubRepoSource === "portfolio_only" && (
              <p className="text-xs text-amber-600 dark:text-amber-500/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                GitHub could not load your full repo list (sign in with GitHub or try again). Charts use only
                repositories linked to this portfolio and Portify import dates — not your full account or real
                repo creation dates on GitHub.
              </p>
            )}
            {scope === "profile" && result.githubRepoSource === "github_per_repo" && (
              <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                Full repo list was unavailable; metadata was loaded per linked project. Counts may be incomplete;
                dates are real GitHub creation times for those repos.
              </p>
            )}
            {scope === "profile" && result.githubRepoSource === "github_first_page" && (
              <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                Loaded the first page of your repos from GitHub; if you have more than 100, the chart may be
                incomplete.
              </p>
            )}
            {result.recharts ? (
              <VisualAgentDataChart payload={result.recharts} />
            ) : (
              result.mermaid?.trim() && <MermaidBlock code={result.mermaid} />
            )}
            <Button type="button" variant="secondary" size="sm" onClick={saveAsDiagram} disabled={saving}>
              {saving ? "Saving…" : "Save chart to this page"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
