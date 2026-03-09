"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles } from "lucide-react";

const JOB_STEPS = ["analyze", "summary", "build", "diagram"] as const;
const STEP_LABELS: Record<string, string> = {
  analyze: "Cloning & analyzing repo",
  summary: "Generating AI summary",
  build: "Preparing build",
  diagram: "Creating diagrams (architecture, data flow, API routes, …)",
};

function jobProgress(
  repoStatus: string,
  jobs: { type: string; status: string; progress: number }[]
): { progress: number; stepLabel: string } {
  if (repoStatus === "QUEUED" && !jobs?.length) return { progress: 0, stepLabel: "Queued, waiting for worker…" };
  if (!jobs?.length) return { progress: 0, stepLabel: "Starting…" };
  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const active = jobs.find((j) => j.status === "ACTIVE");
  const stepLabel = active ? STEP_LABELS[active.type] ?? active.type : completed >= JOB_STEPS.length ? "Done" : "Starting…";
  const pctPerStep = 100 / JOB_STEPS.length;
  const progress = active ? completed * pctPerStep + (active.progress / 100) * pctPerStep : completed * pctPerStep;
  return { progress: Math.round(progress), stepLabel };
}

type Repo = { id: string; repoFullName: string; status: string };
type Portfolio = { id: string; slug: string; repos: Repo[] };

export default function GeneratePage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [syncResult, setSyncResult] = useState<{ slug: string; added: number } | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState<string>("");
  const [activeJobStatus, setActiveJobStatus] = useState<{ progress: number; stepLabel: string } | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await fetch("/api/portfolio/repos");
    const data = await res.json();
    if (data.portfolio) setPortfolio(data.portfolio);
    return data.portfolio;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPortfolio();
      setLoading(false);
    })();
  }, [fetchPortfolio]);

  // Poll when building: aggregate progress and pick one active job for step label
  useEffect(() => {
    if (!building || !portfolio?.repos?.length) return;
    const total = portfolio.repos.length;
    const done = portfolio.repos.filter((r) => r.status === "DONE").length;
    const failed = portfolio.repos.filter((r) => r.status === "FAILED").length;
    const pending = portfolio.repos.filter((r) => r.status === "QUEUED" || r.status === "PROCESSING");
    setOverallProgress(total ? Math.round(((done + failed) / total) * 100) : 0);

    if (pending.length === 0) {
      setCurrentStepLabel("");
      setActiveJobStatus(null);
      return;
    }
    const firstPendingId = pending[0].id;
    const t = setInterval(async () => {
      const res = await fetch(`/api/job-status?id=${firstPendingId}`).then((x) => x.json());
      const { progress, stepLabel } = jobProgress(res.status, res.jobs ?? []);
      setCurrentStepLabel(stepLabel);
      setActiveJobStatus({ progress, stepLabel });
      const updated = await fetchPortfolio();
      if (updated?.repos) {
        const allDone = updated.repos.every((r: Repo) => r.status === "DONE" || r.status === "FAILED");
        if (allDone) setBuilding(false);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [building, portfolio?.repos?.length, fetchPortfolio]);

  // When building finishes (all repos DONE or FAILED), redirect after a short delay
  useEffect(() => {
    if (building || !portfolio?.repos?.length || !syncResult?.slug) return;
    const total = portfolio.repos.length;
    const done = portfolio.repos.filter((r) => r.status === "DONE").length;
    const failed = portfolio.repos.filter((r) => r.status === "FAILED").length;
    if (done + failed < total) return;
    const t = setTimeout(() => router.push(`/${syncResult.slug}`), 1500);
    return () => clearTimeout(t);
  }, [building, portfolio, syncResult, router]);

  async function handleGenerate() {
    setBuilding(true);
    setSyncResult(null);
    setOverallProgress(0);
    setCurrentStepLabel("Adding your repos…");
    try {
      const res = await fetch("/api/portfolio/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncResult({ slug: data.portfolio.slug, added: data.added });
      await fetchPortfolio();
      if (data.added === 0 && portfolio?.repos?.length) {
        setCurrentStepLabel("Portfolio already up to date.");
        setBuilding(false);
      } else if (data.added === 0) {
        setCurrentStepLabel("No new repos to add.");
        setBuilding(false);
      }
    } catch (e) {
      setCurrentStepLabel(e instanceof Error ? e.message : "Something went wrong.");
      setBuilding(false);
    }
  }

  const hasRepos = portfolio?.repos && portfolio.repos.length > 0;
  const allDone = hasRepos && portfolio.repos.every((r) => r.status === "DONE" || r.status === "FAILED");
  const slug = portfolio?.slug ?? syncResult?.slug;
  const showViewPortfolio = slug && (allDone || !hasRepos);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col items-center text-center gap-8">
      {building && (
        <div className="w-full rounded-2xl border border-border bg-card/95 px-5 py-4 text-left shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">Building your portfolio</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentStepLabel || "Getting started…"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Progress value={overallProgress} className="h-2.5" />
            <p className="text-[11px] text-muted-foreground">
              {portfolio?.repos
                ? `${portfolio.repos.filter((r) => r.status === "DONE").length} of ${portfolio.repos.length} projects ready`
                : "Adding repos…"}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            This usually takes 1–3 minutes. You can navigate around Portify while we keep generating in the background.
          </p>
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-6">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Generate your portfolio</h1>
        <p className="text-muted-foreground mb-8">
          We’ll add all your public GitHub repos and build summaries and diagrams for each. Add your own screenshots on each project page. You can add or remove projects later from your portfolio page.
        </p>
        <Button size="lg" className="gap-2" onClick={handleGenerate} disabled={building}>
          <Sparkles className="h-5 w-5" />
          {building ? "Generating…" : "Generate portfolio"}
        </Button>
        {showViewPortfolio && (
          <div className="mt-8 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {hasRepos ? "Your portfolio is ready." : "Add repos from GitHub, then generate to build your portfolio."}
            </p>
            <Link href={`/${slug}`}>
              <Button variant="outline">View my portfolio</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
