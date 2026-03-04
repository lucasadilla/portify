"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { LanguageChart } from "@/components/LanguageChart";
import { Mail, Globe, Linkedin, Github } from "lucide-react";
import { SignedInNav } from "@/components/SignedInNav";

type RepoArtifact = { id: string; type: string; url: string };

type Repo = {
  id: string;
  repoFullName: string;
  customTitle: string | null;
  customSummary: string | null;
  detectedStackJson: string | null;
  artifacts: RepoArtifact[];
};

type EvolutionPoint = { month: string; commits: number };
type LanguageSlice = { name: string; value: number };

type Props = {
  portfolio: {
    slug: string;
    bio: string | null;
    theme: string;
    socials: Record<string, string>;
    user: { name: string | null; image: string | null; email: string | null };
    repos: Repo[];
  };
  isUnpublished?: boolean;
  evolutionData?: EvolutionPoint[];
  languageData?: LanguageSlice[];
  commitsTimeRange?: "all" | "year";
  developerTimeline?: {
    kind: "account" | "repo";
    id: string;
    date: string;
    year: number;
    title: string;
    subtitle?: string | null;
    repoFullName?: string;
    language?: string | null;
    stars?: number;
    hasProjectPage?: boolean;
    stack?: string[];
  }[];
  githubJoinDate?: string | null;
  githubUsername?: string | null;
  viewerUsername?: string | null;
  isOwner?: boolean;
};

const MOCK_EVOLUTION: EvolutionPoint[] = [
  { month: "2024-01", commits: 12 },
  { month: "2024-02", commits: 19 },
  { month: "2024-03", commits: 8 },
  { month: "2024-04", commits: 24 },
  { month: "2024-05", commits: 15 },
];
const MOCK_LANGUAGES: LanguageSlice[] = [
  { name: "TypeScript", value: 40 },
  { name: "JavaScript", value: 25 },
  { name: "CSS", value: 20 },
  { name: "Other", value: 15 },
];

function formatTimelineDate(date: string, fallbackYear: number): string {
  if (!date) return String(fallbackYear);
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(fallbackYear);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();
  return `${month} ${year}`;
}

type TimelineEntry = NonNullable<Props["developerTimeline"]>[number];

interface TimelineCardProps {
  entry: TimelineEntry;
  resolveProjectHref: (entry: TimelineEntry) => string | null;
  router: ReturnType<typeof useRouter>;
  githubUsername?: string | null;
}

function getTimelineSubtitle(entry: TimelineEntry, githubUsername?: string | null): string | null {
  const raw = typeof entry.subtitle === "string" ? entry.subtitle.trim() : "";
  if (raw.length > 0) return raw;
  if (entry.kind === "repo") {
    if (entry.repoFullName && entry.repoFullName.trim().length > 0) {
      return entry.repoFullName;
    }
    if (entry.title && entry.title.trim().length > 0) {
      return entry.title;
    }
    return null;
  }
  if (entry.kind === "account") {
    if (githubUsername && githubUsername.trim().length > 0) {
      return `@${githubUsername}`;
    }
    return "GitHub account created";
  }
  return null;
}

function TimelineCard({ entry, resolveProjectHref, router, githubUsername }: TimelineCardProps) {
  const href = resolveProjectHref(entry);
  const isClickable = href !== null;
  const subtitle = getTimelineSubtitle(entry, githubUsername);
  const handleClick = () => {
    if (!href) return;
    if (entry.kind === "repo" && entry.hasProjectPage) {
      router.push(href);
    } else {
      window.open(href, "_blank");
    }
  };

  return (
    <Card
      className={
        isClickable
          ? "w-full max-w-sm shadow-sm border-border/70 cursor-pointer transition-colors hover:bg-muted/60"
          : "w-full max-w-sm shadow-sm border-border/70"
      }
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <CardContent className="pt-4 pb-4">
        <div className="mb-2 inline-flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-foreground">
            {entry.kind === "account" ? "Joined GitHub" : entry.title}
          </div>
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary">
            {formatTimelineDate(entry.date, entry.year)}
          </div>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>}
        {entry.kind === "repo" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.language && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                {entry.language}
              </span>
            )}
            {Array.isArray(entry.stack) &&
              entry.stack.slice(0, 3).map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            {typeof entry.stars === "number" && entry.stars > 0 && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                ★ {entry.stars}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortfolioView({
  portfolio,
  isUnpublished,
  evolutionData = [],
  languageData = [],
  commitsTimeRange = "year",
  developerTimeline = [],
  githubJoinDate,
  githubUsername,
  viewerUsername,
  isOwner,
}: Props) {
  const router = useRouter();
  const { user, repos, bio, socials } = portfolio;
  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [bioDraft, setBioDraft] = useState(bio ?? "");
  const [emailDraft, setEmailDraft] = useState(socials.email ?? "");
  const [websiteDraft, setWebsiteDraft] = useState(socials.website ?? "");
  const [linkedinDraft, setLinkedinDraft] = useState(socials.linkedin ?? "");
  const [githubDraft, setGithubDraft] = useState(socials.github ?? "");
  const [repoSummaries, setRepoSummaries] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const r of repos) {
      initial[r.id] = r.customSummary ?? "No description.";
    }
    return initial;
  });
  const [showCommitsGraph, setShowCommitsGraph] = useState(true);
  const [showLanguagesGraph, setShowLanguagesGraph] = useState(true);

  useEffect(() => {
    setBioDraft(bio ?? "");
  }, [bio]);

  useEffect(() => {
    setEmailDraft(socials.email ?? "");
    setWebsiteDraft(socials.website ?? "");
    setLinkedinDraft(socials.linkedin ?? "");
    setGithubDraft(socials.github ?? "");
  }, [socials.email, socials.website, socials.linkedin, socials.github]);

  useEffect(() => {
    setRepoSummaries((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const r of repos) {
        if (!(r.id in next)) {
          next[r.id] = r.customSummary ?? "No description.";
        }
      }
      return next;
    });
  }, [repos]);

  const isDemo = portfolio.slug === "demo";
  const evolution = evolutionData.length > 0 ? evolutionData : isDemo ? MOCK_EVOLUTION : [];
  const languages = languageData.length > 0 ? languageData : isDemo ? MOCK_LANGUAGES : [];

  const resolveProjectHref = (entry: (typeof developerTimeline)[number]) => {
    if (entry.kind !== "repo" || !entry.repoFullName) return null;
    const repoName = entry.repoFullName.split("/").pop();
    if (!repoName) return null;
    if (entry.hasProjectPage) {
      return `/u/${portfolio.slug}/${encodeURIComponent(repoName)}`;
    }
    return `https://github.com/${entry.repoFullName}`;
  };

  async function saveProfileInline() {
    setSavingProfile(true);
    try {
      await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bioDraft,
          socialsJson: {
            email: emailDraft,
            website: websiteDraft,
            linkedin: linkedinDraft,
            github: githubDraft,
          },
        }),
      });
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveRepoSummaryInline(id: string) {
    const summary = repoSummaries[id] ?? "";
    await fetch(`/api/portfolio/repos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customSummary: summary }),
    });
    router.refresh();
  }

  async function deleteRepoInline(id: string) {
    await fetch(`/api/portfolio/repos/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      {isUnpublished && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
          This portfolio is not public yet.{" "}
          <Link href="/editor" className="font-medium underline underline-offset-2 hover:no-underline">
            Publish it from the Editor
          </Link>{" "}
          to share the link.
        </div>
      )}
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            Portify
          </Link>
          {viewerUsername ? (
            <SignedInNav username={viewerUsername} />
          ) : (
            <Link href="/api/auth/signin" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {isOwner && (
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs md:text-sm">
            <Button
              variant={editMode ? "default" : "outline"}
              size="xs"
              className="h-7 px-3 text-xs"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? "Exit edit mode" : "Edit on page"}
            </Button>
            <Link href="/editor" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2">
              Open full editor
            </Link>
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2">
              Manage portfolio repos
            </Link>
          </div>
        )}
        <section className="flex flex-col md:flex-row gap-8 items-start mb-12">
          {user.image && (
            <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
              <Image src={user.image} alt={user.name ?? ""} fill className="object-cover" />
            </div>
          )}
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold">{user.name}</h1>
            {editMode && isOwner ? (
              <div className="space-y-3">
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="A short bio about you..."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Email</span>
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Website</span>
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={websiteDraft}
                      onChange={(e) => setWebsiteDraft(e.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">LinkedIn</span>
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={linkedinDraft}
                      onChange={(e) => setLinkedinDraft(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">GitHub</span>
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={githubDraft}
                      onChange={(e) => setGithubDraft(e.target.value)}
                      placeholder="https://github.com/your-handle"
                    />
                  </label>
                </div>
                <Button size="sm" onClick={saveProfileInline} disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </div>
            ) : (
              <>
                {bio && <p className="text-muted-foreground mb-1">{bio}</p>}
                <div className="flex flex-wrap gap-4 text-sm mt-2">
                  {socials.email && (
                    <a href={`mailto:${socials.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Mail className="h-4 w-4" /> {socials.email}
                    </a>
                  )}
                  {socials.website && (
                    <a href={socials.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Globe className="h-4 w-4" /> Website
                    </a>
                  )}
                  {socials.linkedin && (
                    <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                      <Linkedin className="h-4 w-4" /> LinkedIn
                    </a>
                  )}
                  {socials.github && (
                    <a
                      href={socials.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <Github className="h-4 w-4" /> GitHub
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {(showCommitsGraph || showLanguagesGraph) && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Contributions & languages</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {commitsTimeRange === "all"
                ? "All-time contributions and language breakdown across your GitHub"
                : "Contributions (last 12 months) and language breakdown across your GitHub repos"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {showCommitsGraph && (
                <Card className="relative">
                  {editMode && isOwner && (
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                      onClick={() => setShowCommitsGraph(false)}
                    >
                      ×
                    </button>
                  )}
                  <CardContent className="pt-6">
                    <EvolutionGraph data={evolution} />
                  </CardContent>
                </Card>
              )}
              {showLanguagesGraph && (
                <Card className="relative">
                  {editMode && isOwner && (
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                      onClick={() => setShowLanguagesGraph(false)}
                    >
                      ×
                    </button>
                  )}
                  <CardContent className="pt-6">
                    <LanguageChart data={languages} />
                  </CardContent>
                </Card>
              )}
            </div>
            {editMode && isOwner && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {!showCommitsGraph && (
                  <button
                    type="button"
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 hover:bg-muted hover:text-foreground"
                    onClick={() => setShowCommitsGraph(true)}
                  >
                    + Add contributions graph
                  </button>
                )}
                {!showLanguagesGraph && (
                  <button
                    type="button"
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 hover:bg-muted hover:text-foreground"
                    onClick={() => setShowLanguagesGraph(true)}
                  >
                    + Add languages chart
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {developerTimeline.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Developer journey</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {githubJoinDate && githubUsername
                ? `From when ${githubUsername} joined GitHub to today.`
                : "A timeline of your GitHub activity over the years."}
            </p>

            {/* Mobile: simple left-side timeline */}
            <div className="space-y-4 border-l-2 border-primary/50 dark:border-primary pl-4 md:hidden">
              {developerTimeline.map((entry) => {
                const href = resolveProjectHref(entry);
                const isClickable = href !== null;
                const handleClick = () => {
                  if (!href) return;
                  if (entry.kind === "repo" && entry.hasProjectPage) {
                    router.push(href);
                  } else {
                    window.open(href, "_blank");
                  }
                };
                return (
                  <div key={entry.id} className="relative pl-4">
                    <span className="absolute -left-[9px] mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div
                      className={
                        isClickable
                          ? "rounded-md px-3 py-2 -ml-3 cursor-pointer transition-colors hover:bg-muted/60"
                          : "rounded-md px-3 py-2 -ml-3"
                      }
                      onClick={isClickable ? handleClick : undefined}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : -1}
                      onKeyDown={
                        isClickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleClick();
                              }
                            }
                          : undefined
                      }
                    >
                      <p className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
                        {formatTimelineDate(entry.date, entry.year)}
                      </p>
                      <p className="text-xs font-semibold text-foreground">
                        {entry.kind === "account" ? "Joined GitHub" : entry.title}
                      </p>
                      {getTimelineSubtitle(entry, githubUsername) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {getTimelineSubtitle(entry, githubUsername)}
                        </p>
                      )}
                      {entry.kind === "repo" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.language && (
                            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                              {entry.language}
                            </span>
                          )}
                          {Array.isArray(entry.stack) &&
                            entry.stack.slice(0, 3).map((tech) => (
                              <span
                                key={tech}
                                className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {tech}
                              </span>
                            ))}
                          {typeof entry.stars === "number" && entry.stars > 0 && (
                            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                              ★ {entry.stars}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: centered vertical line with alternating cards */}
            <div className="relative hidden md:block">
              <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 border-l-2 border-primary/50 dark:border-primary/80" />
              <div className="space-y-10">
                {developerTimeline.map((entry, index) => {
                  const isLeft = index % 2 === 0;
                  return (
                    <div key={entry.id} className="relative grid grid-cols-2 gap-10">
                      {/* Left side card */}
                      <div
                        className={isLeft ? "col-span-1 flex justify-end" : "col-span-1 flex justify-end opacity-0 md:pointer-events-none"}
                        aria-hidden={!isLeft}
                      >
                        {isLeft && (
                          <TimelineCard
                            entry={entry}
                            resolveProjectHref={resolveProjectHref}
                            router={router}
                            githubUsername={githubUsername}
                          />
                        )}
                      </div>

                      {/* Timeline dot */}
                      <span className="absolute left-1/2 top-6 -translate-x-1/2 h-3 w-3 rounded-full bg-primary shadow-sm" />

                      {/* Right side card */}
                      <div
                        className={!isLeft ? "col-span-1 flex justify-start" : "col-span-1 flex justify-start opacity-0 md:pointer-events-none"}
                        aria-hidden={isLeft}
                      >
                        {!isLeft && (
                          <TimelineCard
                            entry={entry}
                            resolveProjectHref={resolveProjectHref}
                            router={router}
                            githubUsername={githubUsername}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="space-y-8">
          <h2 className="text-2xl font-semibold">Projects</h2>
          {repos.map((repo) => {
            const title = repo.customTitle ?? repo.repoFullName.split("/")[1];
            const repoName = repo.repoFullName.split("/").pop() ?? title;
            const projectHref = `/u/${portfolio.slug}/${encodeURIComponent(repoName)}`;
            const summary = repo.customSummary ?? "No description.";
            const stack = repo.detectedStackJson ? (JSON.parse(repo.detectedStackJson) as string[]) : [];
            const summaryDraft = repoSummaries[repo.id] ?? summary;
            return (
              <Card
                key={repo.id}
                className={
                  editMode
                    ? "transition-colors border-dashed border-border"
                    : "transition-colors hover:bg-muted/50 cursor-pointer"
                }
                onClick={
                  editMode
                    ? undefined
                    : () => {
                        router.push(projectHref);
                      }
                }
                role={editMode ? undefined : "button"}
                tabIndex={editMode ? -1 : 0}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold hover:underline">{title}</h3>
                    <a
                      href={`https://github.com/${repo.repoFullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Github className="h-4 w-4" /> {repo.repoFullName}
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editMode && isOwner ? (
                    <div className="space-y-2">
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={summaryDraft}
                        onChange={(e) =>
                          setRepoSummaries((prev) => ({
                            ...prev,
                            [repo.id]: e.target.value,
                          }))
                        }
                        placeholder="Describe this project in 1–2 sentences..."
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveRepoSummaryInline(repo.id);
                          }}
                        >
                          Save description
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRepoInline(repo.id);
                          }}
                        >
                          Remove from portfolio
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground line-clamp-2 hover:text-foreground">{summary}</p>
                  )}
                  {stack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {stack.slice(0, 5).map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      </main>
    </div>
  );
}
