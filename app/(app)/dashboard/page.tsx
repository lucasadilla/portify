"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RepoCard } from "@/components/RepoCard";
import { Plus, Loader2 } from "lucide-react";

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

type PortfolioRepo = {
  id: string;
  repoFullName: string;
  branch: string;
  pinnedOrder: number;
  customTitle: string | null;
  customSummary: string | null;
  detectedStackJson: string | null;
  status: string;
  artifacts: { id: string; type: string; url: string }[];
};

type Portfolio = {
  id: string;
  slug: string;
  theme: string;
  bio: string | null;
  socialsJson: Record<string, string>;
  isPublished: boolean;
  repos: PortfolioRepo[];
};

export default function DashboardPage() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const JOB_STEPS = ["analyze", "summary", "build", "diagram"] as const;
  const STEP_LABELS: Record<string, string> = {
    analyze: "Cloning & analyzing repo",
    summary: "Generating AI summary",
    build: "Preparing build",
    diagram: "Creating architecture diagram",
  };
  const [jobPoll, setJobPoll] = useState<Record<string, { status: string; progress: number; error?: string; stepLabel?: string }>>({});
  const [repoErrors, setRepoErrors] = useState<Record<string, string>>({});

  function jobProgress(repoStatus: string, jobs: { type: string; status: string; progress: number }[]): { progress: number; stepLabel: string } {
    if (repoStatus === "QUEUED" && !jobs?.length) return { progress: 0, stepLabel: "Queued, waiting for worker…" };
    if (!jobs?.length) return { progress: 0, stepLabel: "Starting…" };
    const completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const active = jobs.find((j) => j.status === "ACTIVE");
    const stepLabel = active ? STEP_LABELS[active.type] ?? active.type : completed >= JOB_STEPS.length ? "Done" : "Starting…";
    const pctPerStep = 100 / JOB_STEPS.length;
    const progress = active
      ? completed * pctPerStep + (active.progress / 100) * pctPerStep
      : completed * pctPerStep;
    return { progress: Math.round(progress), stepLabel };
  }

  const fetchPortfolio = useCallback(async () => {
    const res = await fetch("/api/portfolio/repos");
    const data = await res.json();
    if (data.portfolio) setPortfolio(data.portfolio);
  }, []);

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    if (res.ok) {
      const data = await res.json();
      setRepos(data);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchRepos(), fetchPortfolio()]);
      setLoading(false);
    })();
  }, [fetchRepos, fetchPortfolio]);

  useEffect(() => {
    if (!portfolio?.repos?.length) return;
    const ids = portfolio.repos.map((r) => r.id).filter((id) => {
      const r = portfolio.repos.find((x) => x.id === id);
      return r?.status === "PROCESSING" || r?.status === "QUEUED";
    });
    if (ids.length === 0) return;
    const t = setInterval(async () => {
      for (const id of ids) {
        const r = await fetch(`/api/job-status?id=${id}`).then((x) => x.json());
        const failedJob = r.jobs?.find((j: { status: string; error?: string }) => j.status === "FAILED" && j.error);
        const { progress, stepLabel } = jobProgress(r.status, r.jobs ?? []);
        setJobPoll((p) => ({ ...p, [id]: { status: r.status, progress, stepLabel, error: failedJob?.error } }));
        if (r.status === "FAILED" && failedJob?.error) setRepoErrors((e) => ({ ...e, [id]: failedJob.error }));
        if (r.status === "DONE" || r.status === "FAILED") await fetchPortfolio();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [portfolio?.repos, fetchPortfolio]);

  useEffect(() => {
    if (!portfolio?.repos?.length) return;
    const failedIds = portfolio.repos.filter((r) => r.status === "FAILED").map((r) => r.id);
    if (failedIds.length === 0) return;
    (async () => {
      for (const id of failedIds) {
        const r = await fetch(`/api/job-status?id=${id}`).then((x) => x.json());
        const failedJob = r.jobs?.find((j: { status: string; error?: string }) => j.status === "FAILED" && j.error);
        if (failedJob?.error) setRepoErrors((e) => ({ ...e, [id]: failedJob.error }));
      }
    })();
  }, [portfolio?.repos]);

  async function addRepo(repo: GitHubRepo) {
    setAdding(repo.fullName);
    try {
      const res = await fetch("/api/portfolio/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: repo.fullName, branch: repo.defaultBranch }),
      });
      const data = await res.json();
      if (data.repo) await fetchPortfolio();
    } finally {
      setAdding(null);
    }
  }

  async function generateRepo(portfolioRepoId: string) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioRepoId }),
    });
    if (res.ok) await fetchPortfolio();
  }

  async function removeRepo(portfolioRepoId: string) {
    await fetch(`/api/portfolio/repos/${portfolioRepoId}`, { method: "DELETE" });
    await fetchPortfolio();
  }

  const addedNames = new Set(portfolio?.repos?.map((r) => r.repoFullName) ?? []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Add repos from GitHub and generate your portfolio. Your portfolio will be live at{" "}
          <strong>portify.dev/{portfolio?.slug ?? "username"}</strong>.
        </p>
      </div>

      {portfolio?.repos && portfolio.repos.some((r) => r.status === "QUEUED" || r.status === "PROCESSING") && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong>Jobs running.</strong> Usually finishes in <strong>1–3 minutes</strong>. If it’s stuck: (1) Ensure <strong>Redis</strong> (e.g. Upstash) and <code className="rounded bg-black/10 px-1">REDIS_URL</code> are set. (2) Run <code className="rounded bg-black/10 px-1">npm run worker</code> in a <strong>separate terminal</strong> and watch for errors (e.g. git, OpenAI key).
        </div>
      )}

      {portfolio?.repos && portfolio.repos.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your portfolio repos</h2>
          <div className="grid gap-4">
            {portfolio.repos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                summary={repo.customSummary}
                stack={repo.detectedStackJson ? JSON.parse(repo.detectedStackJson) : null}
                onGenerate={generateRepo}
                onRemove={removeRepo}
                jobStatus={jobPoll[repo.id] ? { status: jobPoll[repo.id].status, progress: jobPoll[repo.id].progress, stepLabel: jobPoll[repo.id].stepLabel, error: jobPoll[repo.id].error } : undefined}
                failureReason={repoErrors[repo.id]}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Add from GitHub</h2>
        <p className="text-sm text-muted-foreground">Select a repo to add to your portfolio.</p>
        <div className="grid gap-2">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{repo.fullName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{repo.description ?? "No description"}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={addedNames.has(repo.fullName) || adding === repo.fullName}
                    onClick={() => addRepo(repo)}
                  >
                    {adding === repo.fullName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
        {repos.length === 0 && (
          <p className="text-sm text-muted-foreground">No public repos found. Make sure you’ve granted repo access to Portify.</p>
        )}
      </div>
    </div>
  );
}
