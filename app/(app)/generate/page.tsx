"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

const JOB_STEPS = ["analyze", "summary", "build", "diagram"] as const;
const STEP_LABELS: Record<string, string> = {
  analyze: "Cloning & analyzing repo",
  summary: "Generating AI summary",
  build: "Preparing build",
  diagram: "Creating diagrams (architecture, data flow, API routes)",
};

function jobProgress(
  repoStatus: string,
  jobs: { type: string; status: string; progress: number }[]
): { progress: number; stepLabel: string } {
  if (repoStatus === "QUEUED" && !jobs?.length) return { progress: 0, stepLabel: "Waiting for worker…" };
  if (!jobs?.length) return { progress: 0, stepLabel: "Starting…" };
  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const active = jobs.find((j) => j.status === "ACTIVE");
  const stepLabel = active ? STEP_LABELS[active.type] ?? active.type : completed >= JOB_STEPS.length ? "Finishing…" : "Starting…";
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

type Phase = "idle" | "preparing" | "building";

const POLL_INTERVAL_MS = 2000;
const POLL_INTERVAL_SLOW_MS = 4000;
const QUEUED_SLOW_AFTER_MS = 20000;
const PREPARE_TIMEOUT_MS = 50000;

export default function GeneratePage() {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepoFullNames, setSelectedRepoFullNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [prepareLabel, setPrepareLabel] = useState("");
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ slug: string; added: number } | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentRepoName, setCurrentRepoName] = useState<string | null>(null);
  const [currentStepLabel, setCurrentStepLabel] = useState<string>("");
  const [connectionIssue, setConnectionIssue] = useState(false);
  const lastQueuedAtRef = useRef<number | null>(null);

  const fetchPortfolio = useCallback(async (): Promise<Portfolio | null> => {
    try {
      const res = await fetch("/api/portfolio/repos");
      const data = await res.json();
      if (data.portfolio) setPortfolio(data.portfolio);
      return data.portfolio ?? null;
    } catch {
      return null;
    }
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

  // If the user refreshes or navigates back while jobs are running,
  // detect in-progress generation and resume the "building" UI.
  useEffect(() => {
    if (loading) return;
    if (phase !== "idle") return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/generate/status");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const portfolioData = data.portfolio ?? null;
        if (portfolioData?.repos) setPortfolio(portfolioData);

        const reposInPortfolio = portfolioData?.repos ?? [];
        const total = reposInPortfolio.length;
        const done = reposInPortfolio.filter((r: Repo) => r.status === "DONE").length;
        const failed = reposInPortfolio.filter((r: Repo) => r.status === "FAILED").length;
        const pending = reposInPortfolio.filter(
          (r: Repo) => r.status === "QUEUED" || r.status === "PROCESSING"
        );

        if (!pending.length) return;

        // There is active work: resume building state and seed progress/labels.
        setPhase("building");
        setOverallProgress(total ? Math.round(((done + failed) / total) * 100) : 0);

        const first = pending[0];
        setCurrentRepoName(first.repoFullName);

        const activeJob = data.activeJob ?? null;
        const status = activeJob?.status ?? first.status;
        const jobs = activeJob?.jobs ?? [];
        const { stepLabel } = jobProgress(status, jobs);
        setCurrentStepLabel(stepLabel);
      } catch {
        // Ignore; regular polling will handle connection issues when building.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, phase]);

  // If we stay in "preparing" too long, bail out so the user is not stuck
  useEffect(() => {
    if (phase !== "preparing") return;
    const t = setTimeout(() => {
      setPrepareError("Preparation is taking too long. Check your connection and try again, or reset stuck repos.");
      setPhase("idle");
    }, PREPARE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Poll when building: single request per cycle, adaptive interval, retry on failure
  useEffect(() => {
    if (phase !== "building") return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let mounted = true;

    const poll = async (isRetry = false) => {
      if (!mounted) return;
      try {
        const res = await fetch("/api/generate/status");
        if (!mounted) return;
        if (!res.ok) throw new Error("status not ok");
        const data = await res.json();
        setConnectionIssue(false);

        const portfolioData = data.portfolio ?? null;
        if (portfolioData?.repos) setPortfolio(portfolioData);

        const repos = portfolioData?.repos ?? [];
        const total = repos.length;
        const done = repos.filter((r: Repo) => r.status === "DONE").length;
        const failed = repos.filter((r: Repo) => r.status === "FAILED").length;
        const pending = repos.filter(
          (r: Repo) => r.status === "QUEUED" || r.status === "PROCESSING"
        );

        setOverallProgress(total ? Math.round(((done + failed) / total) * 100) : 0);

        if (pending.length === 0) {
          lastQueuedAtRef.current = null;
          setPhase("idle");
          setCurrentRepoName(null);
          setCurrentStepLabel("");
          return;
        }

        const first = pending[0];
        setCurrentRepoName(first.repoFullName);

        if (first.status === "QUEUED") {
          if (lastQueuedAtRef.current === null) lastQueuedAtRef.current = Date.now();
        } else {
          lastQueuedAtRef.current = null;
        }

        const activeJob = data.activeJob ?? null;
        const status = activeJob?.status ?? first.status;
        const jobs = activeJob?.jobs ?? [];
        const { stepLabel } = jobProgress(status, jobs);
        setCurrentStepLabel(stepLabel);

        const now = Date.now();
        const queuedDuration = lastQueuedAtRef.current ? now - lastQueuedAtRef.current : 0;
        const interval =
          queuedDuration >= QUEUED_SLOW_AFTER_MS ? POLL_INTERVAL_SLOW_MS : POLL_INTERVAL_MS;
        timeoutId = setTimeout(() => poll(), interval);
      } catch {
        if (!mounted) return;
        setConnectionIssue(true);
        if (!isRetry) {
          timeoutId = setTimeout(() => poll(true), 1000);
        } else {
          timeoutId = setTimeout(() => poll(false), POLL_INTERVAL_MS);
        }
      }
    };

    poll();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [phase]);

  // When we leave building and all repos are done/failed, redirect
  useEffect(() => {
    if (phase !== "idle" || !portfolio?.repos?.length || !syncResult?.slug) return;
    const total = portfolio.repos.length;
    const done = portfolio.repos.filter((r) => r.status === "DONE").length;
    const failed = portfolio.repos.filter((r) => r.status === "FAILED").length;
    if (done + failed < total) return;
    const t = setTimeout(() => router.push(`/${syncResult.slug}`), 1200);
    return () => clearTimeout(t);
  }, [phase, portfolio, syncResult, router]);

  async function handleGenerate() {
    if (selectedRepoFullNames.size === 0) {
      setPrepareError("Select at least one repo.");
      return;
    }

    setPhase("preparing");
    setPrepareError(null);
    setConnectionIssue(false);
    setSyncResult(null);
    setOverallProgress(0);
    setPrepareLabel("Adding repos…");

    try {
      const toAdd = Array.from(selectedRepoFullNames)
        .map((fullName) => repos.find((r) => r.fullName === fullName))
        .filter(Boolean) as GitHubRepo[];

      const addResults = await Promise.all(
        toAdd.map((repo) =>
          fetch("/api/portfolio/repos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoFullName: repo.fullName, branch: repo.defaultBranch }),
          }).then(async (res) => ({ res, data: await res.json() }))
        )
      );

      const addedIds: string[] = addResults
        .filter(({ res, data }) => res.ok && data.repo?.id)
        .map(({ data }) => data.repo.id);

      const updated = await fetchPortfolio();
      const idsToGenerate =
        addedIds.length > 0
          ? addedIds
          : (updated?.repos ?? [])
              .filter((r: Repo) => selectedRepoFullNames.has(r.repoFullName))
              .map((r: Repo) => r.id);

      if (idsToGenerate.length === 0) {
        setPrepareError("No repos to generate. Add or select repos first.");
        setPhase("idle");
        return;
      }

      setPrepareLabel("Queuing jobs…");

      const queueResults = await Promise.all(
        idsToGenerate.map((id) =>
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portfolioRepoId: id }),
          }).then((res) => ({ res, id }))
        )
      );

      const queued = queueResults.filter((r) => r.res.ok).length;
      const failed = queueResults.filter((r) => !r.res.ok).length;
      if (failed > 0 && queued === 0) {
        setPrepareError("Failed to queue jobs. Try again or reset stuck repos.");
        setPhase("idle");
        return;
      }

      const final = await fetchPortfolio();
      const slug = (final ?? updated)?.slug ?? "";
      if (slug) setSyncResult({ slug, added: idsToGenerate.length });
      setPhase("building");
    } catch (e) {
      setPrepareError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  const hasRepos = portfolio?.repos && portfolio.repos.length > 0;
  const allDone = hasRepos && portfolio.repos.every((r) => r.status === "DONE" || r.status === "FAILED");
  const slug = portfolio?.slug ?? syncResult?.slug;
  const showViewPortfolio = slug && (allDone || !hasRepos);
  const isBusy = phase !== "idle";
  const hasStuck = portfolio?.repos?.some((r) => r.status === "QUEUED" || r.status === "PROCESSING");

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
      {prepareError && (
        <div className="w-full flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{prepareError}</span>
          <button
            type="button"
            className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
            onClick={() => setPrepareError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {(phase === "preparing" || phase === "building") && (
        <div className="w-full rounded-2xl border border-border bg-card/95 px-5 py-4 text-left shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-full bg-primary/10 p-2">
              {phase === "preparing" ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold">
                {phase === "preparing" ? "Preparing" : "Building your portfolio"}
              </h2>
              <p className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
                <span className="truncate">
                  {phase === "preparing"
                    ? prepareLabel
                    : currentRepoName
                      ? `${currentRepoName} — ${currentStepLabel || "…"}`
                      : currentStepLabel || "Starting…"}
                </span>
                {(phase === "preparing" || phase === "building") && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
                )}
              </p>
            </div>
          </div>
          {phase === "building" && (
            <>
              <div className="space-y-2">
                <Progress value={overallProgress} className="h-2.5" />
                <p className="text-[11px] text-muted-foreground">
                  {portfolio?.repos
                    ? `${portfolio.repos.filter((r) => r.status === "DONE").length} of ${portfolio.repos.length} projects ready`
                    : "…"}
                </p>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Usually 1–3 min. You can leave this page; we’ll keep generating.
              </p>
              {connectionIssue && (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                  Connection issue, retrying…
                </p>
              )}
              {hasStuck && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    const stuck = (portfolio?.repos ?? []).filter(
                      (r: Repo) => r.status === "QUEUED" || r.status === "PROCESSING"
                    );
                    await Promise.all(
                      stuck.map((r) =>
                        fetch(`/api/portfolio/repos/${r.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ reset: true }),
                        })
                      )
                    );
                    await fetchPortfolio();
                  }}
                >
                  Reset stuck repos
                </Button>
              )}
            </>
          )}
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
        <Button size="lg" className="gap-2 mb-4" onClick={handleGenerate} disabled={isBusy}>
          <Sparkles className="h-5 w-5" />
          {phase === "preparing" ? "Preparing…" : phase === "building" ? "Building…" : "Generate portfolio"}
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
