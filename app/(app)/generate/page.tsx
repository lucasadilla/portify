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
type GitHubRepo = {
  id: number;
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  language: string | null;
  stargazersCount: number;
  pushedAt: string;
};

export default function GeneratePage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<Set<string>>(new Set());
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

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    if (!res.ok) return;
    const data = await res.json();
    setRepos(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchPortfolio(), fetchRepos()]);
      setLoading(false);
    })();
  }, [fetchPortfolio, fetchRepos]);

  // Poll when building: aggregate progress and pick one active job for step label
  useEffect(() => {
    if (!building) return;
    const t = setInterval(async () => {
      const latest = await fetchPortfolio();
      if (!latest?.repos?.length) return;
      const total = latest.repos.length;
      const done = latest.repos.filter((r: Repo) => r.status === "DONE").length;
      const failed = latest.repos.filter((r: Repo) => r.status === "FAILED").length;
      const pending = latest.repos.filter(
        (r: Repo) => r.status === "QUEUED" || r.status === "PROCESSING"
      );
      setOverallProgress(total ? Math.round(((done + failed) / total) * 100) : 0);

      if (pending.length === 0) {
        setCurrentStepLabel("");
        setActiveJobStatus(null);
        setBuilding(false);
        return;
      }

      const firstPendingId = pending[0].id;
      const res = await fetch(`/api/job-status?id=${firstPendingId}`).then((x) => x.json());
      const { progress, stepLabel } = jobProgress(res.status, res.jobs ?? []);
      setCurrentStepLabel(stepLabel);
      setActiveJobStatus({ progress, stepLabel });
    }, 2000);

    return () => clearInterval(t);
  }, [building, fetchPortfolio]);

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
    if (selectedRepoFullNames.size === 0) {
      setCurrentStepLabel("Select at least one repo to generate.");
      return;
    }

    setBuilding(true);
    setSyncResult(null);
    setOverallProgress(0);
    setCurrentStepLabel("Adding selected repos…");

    try {
      const addedIds: string[] = [];

      for (const fullName of selectedRepoFullNames) {
        const repo = repos.find((r) => r.fullName === fullName);
        if (!repo) continue;
        const res = await fetch("/api/portfolio/repos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoFullName: repo.fullName, branch: repo.defaultBranch }),
        });
        const data = await res.json();
        if (res.ok && data.repo?.id) {
          addedIds.push(data.repo.id as string);
        }
      }

      const updated = await fetchPortfolio();
      // Queue jobs for every selected repo that's in the portfolio (by name match)
      const idsToGenerate =
        addedIds.length > 0
          ? addedIds
          : (updated?.repos ?? [])
              .filter((r: Repo) => selectedRepoFullNames.has(r.repoFullName))
              .map((r: Repo) => r.id);

      if (idsToGenerate.length === 0) {
        setCurrentStepLabel("No repos to generate. Add or select repos first.");
        setBuilding(false);
        return;
      }

      setCurrentStepLabel("Queuing jobs for selected repos…");

      for (const id of idsToGenerate) {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioRepoId: id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[generate] /api/generate failed", id, res.status, err);
        }
      }

      const final = await fetchPortfolio();
      if (final?.slug) {
        setSyncResult({ slug: final.slug, added: idsToGenerate.length });
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
    <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-10">
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
        <p className="text-muted-foreground mb-6 max-w-2xl">
          Pick the GitHub repos you actually want to showcase. We&apos;ll generate summaries, diagrams, and graphs for the ones you select.
        </p>
        <Button size="lg" className="gap-2 mb-4" onClick={handleGenerate} disabled={building}>
          <Sparkles className="h-5 w-5" />
          {building ? "Generating…" : "Generate portfolio"}
        </Button>
        {showViewPortfolio && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {hasRepos ? "Your portfolio is ready." : "Add repos from GitHub, then generate to build your portfolio."}
            </p>
            <Link href={`/${slug}`}>
              <Button variant="outline">View my portfolio</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="w-full text-left space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Select repos to include</h2>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            onClick={() => {
              if (selectedRepoFullNames.size === repos.length) {
                setSelectedRepoFullNames(new Set());
              } else {
                setSelectedRepoFullNames(new Set(repos.map((r) => r.fullName)));
              }
            }}
          >
            {selectedRepoFullNames.size === repos.length ? "Clear selection" : "Select all"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          We only generate for the repos you pick. You can always add more later from the dashboard.
        </p>
        <div className="mt-2 max-h-[420px] w-full overflow-y-auto rounded-xl border border-border/60 bg-card/90">
          {repos.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No public repos found. Make sure Portify has access to your GitHub account.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {repos.map((r) => {
                const inPortfolio = portfolio?.repos?.some((p) => p.repoFullName === r.fullName);
                const checked = selectedRepoFullNames.has(r.fullName);
                return (
                  <li
                    key={r.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 text-left text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border border-border bg-background"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedRepoFullNames((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.fullName);
                          else next.delete(r.fullName);
                          return next;
                        });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{r.fullName}</p>
                        {inPortfolio && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/40">
                            In portfolio
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.description ?? "No description"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {r.language && <span>{r.language}</span>}
                        <span>★ {r.stargazersCount}</span>
                        <span>
                          Updated{" "}
                          {new Date(r.pushedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
