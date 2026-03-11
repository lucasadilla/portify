"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTechBadgeClassName } from "@/lib/badgeColors";
import { Button } from "@/components/ui/button";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { LanguageChart } from "@/components/LanguageChart";
import { Mail, Globe, Linkedin, Github, Twitter, Instagram, Youtube, MessageCircle, Code2, BookOpen, Newspaper, Video, Plus, Loader2, ChevronUp, ChevronDown, Pin, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SignedInNav } from "@/components/SignedInNav";
import { AnimateInView } from "@/components/AnimateInView";
import { SOCIAL_LINK_KEYS } from "@/lib/socialLinks";
import { PortfolioBackground, BACKGROUND_STYLES } from "@/components/portfolio-backgrounds";
import { COLOR_PALETTES, getPaletteStyle, getPaletteIds } from "@/lib/colorPalettes";

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

const DEFAULT_SECTION_ORDER = ["profile", "contributions", "developer_journey", "projects"] as const;
const SECTION_LABELS: Record<string, string> = {
  profile: "Profile (name, bio, photo)",
  contributions: "Contributions & languages",
  developer_journey: "Developer journey",
  projects: "Projects",
};

const DEFAULT_CHART_ORDER = ["evolution", "languages"] as const;
function normalizeChartOrder(order: string[] | undefined): string[] {
  const valid = new Set<string>(DEFAULT_CHART_ORDER);
  if (!order?.length) return [...DEFAULT_CHART_ORDER];
  const result = order.filter((id) => valid.has(id));
  for (const id of DEFAULT_CHART_ORDER) if (!result.includes(id)) result.push(id);
  return result;
}

type Props = {
  portfolio: {
    slug: string;
    bio: string | null;
    theme: string;
    backgroundStyle?: string;
    displayName?: string | null;
    imageUrl?: string | null;
    sectionOrder?: string[];
    contributionsChartOrder?: string[];
    colorPalette?: string | null;
    socials: Record<string, string>;
    user: { name: string | null; image: string | null; email: string | null };
    repos: Repo[];
  };
  isUnpublished?: boolean;
  isPublished?: boolean;
  evolutionData?: EvolutionPoint[];
  languageData?: LanguageSlice[];
  commitsTimeRange?: "all" | "year";
  developerTimeline?: {
    kind: "account" | "repo" | "custom";
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
    customKind?: string;
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

const SOCIAL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  email: Mail,
  website: Globe,
  linkedin: Linkedin,
  github: Github,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  discord: MessageCircle,
  stackoverflow: Code2,
  devto: BookOpen,
  medium: Newspaper,
  twitch: Video,
};

const CAREER_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "job_start", label: "Got a job" },
  { value: "job_end", label: "Left a job" },
  { value: "education_start", label: "Started school" },
  { value: "graduation", label: "Graduated" },
  { value: "hackathon", label: "Hackathon" },
  { value: "certification", label: "Certification" },
  { value: "career_update", label: "Career update" },
  { value: "custom", label: "Other" },
];

const CAREER_KIND_LABELS: Record<string, string> = Object.fromEntries(
  CAREER_KIND_OPTIONS.map((o) => [o.value, o.label])
);

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
  onDelete?: (id: string) => void;
  onEdit?: (entry: TimelineEntry) => void;
  isEditMode?: boolean;
}

function getTimelineSubtitle(entry: TimelineEntry, githubUsername?: string | null): string | null {
  const raw = typeof entry.subtitle === "string" ? entry.subtitle.trim() : "";
  if (raw.length > 0) return raw;
  if (entry.kind === "custom") return null;
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

function TimelineCard({ entry, resolveProjectHref, router, githubUsername, onDelete, onEdit, isEditMode }: TimelineCardProps) {
  const href = resolveProjectHref(entry);
  const isClickable = href !== null;
  const subtitle = getTimelineSubtitle(entry, githubUsername);
  const isCustom = entry.kind === "custom";
  const showActions = isCustom && isEditMode && (onDelete || onEdit);
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
      onClick={showActions ? undefined : isClickable ? handleClick : undefined}
      role={showActions ? undefined : isClickable ? "button" : undefined}
      tabIndex={showActions ? -1 : isClickable ? 0 : -1}
      onKeyDown={
        showActions
          ? undefined
          : isClickable
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
        {showActions && (
          <div className="flex gap-1 mb-2 justify-end">
            {onEdit && (
              <Button size="sm" variant="secondary" className="h-6 text-xs" onClick={() => onEdit(entry)}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => onDelete(entry.id)}>
                Remove
              </Button>
            )}
          </div>
        )}
        <div className="mb-2 inline-flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-foreground">
            {entry.kind === "account" ? "Joined GitHub" : entry.title}
          </div>
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary">
            {formatTimelineDate(entry.date, entry.year)}
          </div>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>}
        {entry.kind === "custom" && entry.customKind && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {CAREER_KIND_LABELS[entry.customKind] ?? entry.customKind}
          </p>
        )}
        {entry.kind === "repo" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.language && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTechBadgeClassName(entry.language)}`}>
                {entry.language}
              </span>
            )}
            {Array.isArray(entry.stack) &&
              entry.stack.slice(0, 3).map((tech) => (
                <span
                  key={tech}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTechBadgeClassName(tech)}`}
                >
                  {tech}
                </span>
              ))}
            {typeof entry.stars === "number" && entry.stars > 0 && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTechBadgeClassName("Stars")}`}>
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
  isPublished: isPublishedProp = true,
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
  const { user, repos, bio, socials, slug, backgroundStyle = "minimal", displayName: displayNameOverride, imageUrl: imageUrlOverride, sectionOrder: sectionOrderProp, contributionsChartOrder: contributionsChartOrderProp, colorPalette: colorPaletteProp } = portfolio;

  function normalizeSectionOrder(order: string[] | undefined): string[] {
    const valid = new Set<string>(DEFAULT_SECTION_ORDER);
    if (!order?.length) return [...DEFAULT_SECTION_ORDER];
    const result = order.filter((id) => valid.has(id));
    for (const id of DEFAULT_SECTION_ORDER) if (!result.includes(id)) result.push(id);
    return result;
  }
  const [editMode, setEditMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [bioDraft, setBioDraft] = useState(bio ?? "");
  const [slugDraft, setSlugDraft] = useState(slug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [socialsDraft, setSocialsDraft] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const { key } of SOCIAL_LINK_KEYS) {
      initial[key] = socials[key] ?? "";
    }
    return initial;
  });
  const [repoSummaries, setRepoSummaries] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const r of repos) {
      initial[r.id] = r.customSummary ?? "No description.";
    }
    return initial;
  });
  const [showCommitsGraph, setShowCommitsGraph] = useState(true);
  const [showLanguagesGraph, setShowLanguagesGraph] = useState(true);
  const [showDeveloperJourney, setShowDeveloperJourney] = useState(true);
  const [isPublishedDraft, setIsPublishedDraft] = useState(isPublishedProp);
  const [newCareerDate, setNewCareerDate] = useState("");
  const [newCareerTitle, setNewCareerTitle] = useState("");
  const [newCareerSubtitle, setNewCareerSubtitle] = useState("");
  const [newCareerKind, setNewCareerKind] = useState("career_update");
  const [addingCareer, setAddingCareer] = useState(false);
  const [editingCareerId, setEditingCareerId] = useState<string | null>(null);
  const [editCareerDraft, setEditCareerDraft] = useState<{ date: string; title: string; subtitle: string; kind: string }>({
    date: "",
    title: "",
    subtitle: "",
    kind: "custom",
  });
  const [showAddProject, setShowAddProject] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<{ fullName: string; defaultBranch: string; description: string | null }[]>([]);
  const [addingRepo, setAddingRepo] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [backgroundStyleDraft, setBackgroundStyleDraft] = useState(backgroundStyle);
  const [displayNameDraft, setDisplayNameDraft] = useState(displayNameOverride ?? user.name ?? "");
  const [imageUrlDraft, setImageUrlDraft] = useState(imageUrlOverride ?? user.image ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [sectionOrderDraft, setSectionOrderDraft] = useState<string[]>(() => normalizeSectionOrder(sectionOrderProp));
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [contributionsChartOrderDraft, setContributionsChartOrderDraft] = useState<string[]>(() => normalizeChartOrder(contributionsChartOrderProp));
  const [draggedChartId, setDraggedChartId] = useState<string | null>(null);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [colorPaletteDraft, setColorPaletteDraft] = useState<string>(colorPaletteProp ?? "default");
  const effectiveOrder = editMode && isOwner ? sectionOrderDraft : normalizeSectionOrder(sectionOrderProp);
  const effectiveChartOrder = editMode && isOwner ? contributionsChartOrderDraft : normalizeChartOrder(contributionsChartOrderProp);
  const effectiveColorPalette = editMode && isOwner ? colorPaletteDraft : (colorPaletteProp ?? "default");
  const paletteStyle = getPaletteStyle(effectiveColorPalette);

  useEffect(() => {
    setBioDraft(bio ?? "");
  }, [bio]);

  useEffect(() => {
    setIsPublishedDraft(isPublishedProp);
  }, [isPublishedProp]);

  useEffect(() => {
    setSlugDraft(slug);
  }, [slug]);

  useEffect(() => {
    setBackgroundStyleDraft(backgroundStyle);
  }, [backgroundStyle]);
  useEffect(() => {
    setDisplayNameDraft(displayNameOverride ?? user.name ?? "");
  }, [displayNameOverride, user.name]);
  useEffect(() => {
    setImageUrlDraft(imageUrlOverride ?? user.image ?? "");
  }, [imageUrlOverride, user.image]);
  useEffect(() => {
    setSectionOrderDraft(normalizeSectionOrder(sectionOrderProp));
  }, [sectionOrderProp]);
  useEffect(() => {
    setContributionsChartOrderDraft(normalizeChartOrder(contributionsChartOrderProp));
  }, [contributionsChartOrderProp]);
  useEffect(() => {
    setColorPaletteDraft(colorPaletteProp ?? "default");
  }, [colorPaletteProp]);

  useEffect(() => {
    setSocialsDraft((prev) => {
      const next = { ...prev };
      for (const { key } of SOCIAL_LINK_KEYS) {
        next[key] = socials[key] ?? "";
      }
      return next;
    });
  }, [socials]);

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
      return `/${portfolio.slug}/${encodeURIComponent(repoName)}`;
    }
    return `https://github.com/${entry.repoFullName}`;
  };

  async function createCareerEntry() {
    const dateStr = newCareerDate.trim() || `${new Date().getFullYear()}-01`;
    const titleStr = newCareerTitle.trim();
    if (!titleStr) return;
    setAddingCareer(true);
    try {
      await fetch("/api/portfolio/timeline-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          title: titleStr,
          subtitle: newCareerSubtitle.trim() || null,
          kind: newCareerKind,
        }),
      });
      router.refresh();
      setNewCareerDate("");
      setNewCareerTitle("");
      setNewCareerSubtitle("");
      setNewCareerKind("career_update");
    } finally {
      setAddingCareer(false);
    }
  }

  async function deleteCareerEntry(id: string) {
    await fetch(`/api/portfolio/timeline-entries/${id}`, { method: "DELETE" });
    router.refresh();
    setEditingCareerId(null);
  }

  async function saveCareerEntry(id: string) {
    await fetch(`/api/portfolio/timeline-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editCareerDraft.date,
        title: editCareerDraft.title,
        subtitle: editCareerDraft.subtitle || null,
        kind: editCareerDraft.kind,
      }),
    });
    router.refresh();
    setEditingCareerId(null);
  }

  function startEditingCareer(entry: (typeof developerTimeline)[number]) {
    if (entry.kind !== "custom") return;
    setEditingCareerId(entry.id);
    setEditCareerDraft({
      date: entry.date,
      title: entry.title,
      subtitle: entry.subtitle ?? "",
      kind: entry.customKind ?? "custom",
    });
  }

  async function saveProfileInline() {
    setSlugError(null);
    setSavingProfile(true);
    try {
      const socialsPayload: Record<string, string> = {};
      for (const { key } of SOCIAL_LINK_KEYS) {
        const v = socialsDraft[key]?.trim();
        if (v) socialsPayload[key] = v;
      }
      const res = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bioDraft,
          socialsJson: socialsPayload,
          isPublished: isPublishedDraft,
          slug: slugDraft.trim() || undefined,
          backgroundStyle: backgroundStyleDraft,
          displayName: displayNameDraft.trim() || null,
          imageUrl: imageUrlDraft.trim() || null,
          sectionOrder: sectionOrderDraft,
          contributionsChartOrder: contributionsChartOrderDraft,
          colorPalette: colorPaletteDraft === "default" ? null : colorPaletteDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSlugError(data.error ?? "Failed to save");
        return;
      }
      const newSlug = data.slug ?? slug;
      router.refresh();
      if (newSlug !== slug) {
        router.replace(`/${newSlug}`);
      }
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

  async function openAddProject() {
    setShowAddProject(true);
    const res = await fetch("/api/repos");
    if (res.ok) {
      const data = await res.json();
      const existing = new Set(repos.map((r) => r.repoFullName.toLowerCase()));
      setAvailableRepos(
        data.filter((r: { fullName: string }) => !existing.has(r.fullName.toLowerCase())).map((r: { fullName: string; defaultBranch: string; description: string | null }) => ({
          fullName: r.fullName,
          defaultBranch: r.defaultBranch ?? "main",
          description: r.description ?? null,
        }))
      );
    }
  }

  async function reorderRepos(newOrder: Repo[]) {
    const orderedIds = newOrder.map((r) => r.id);
    const res = await fetch("/api/portfolio/repos/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (res.ok) router.refresh();
    setReorderingId(null);
  }

  function moveProjectToIndex(draggedRepoId: string, dropIndex: number) {
    const fromIdx = repos.findIndex((r) => r.id === draggedRepoId);
    if (fromIdx < 0 || fromIdx === dropIndex) return;
    const next = [...repos];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(dropIndex, 0, removed);
    setReorderingId(draggedRepoId);
    reorderRepos(next);
    setDraggedProjectId(null);
  }

  async function moveProject(repoId: string, direction: "top" | "up" | "down") {
    const current = [...repos];
    const from = current.findIndex((r) => r.id === repoId);
    if (from < 0) return;
    if (direction === "top" && from === 0) return;
    if (direction === "up" && from === 0) return;
    if (direction === "down" && from === current.length - 1) return;
    const [item] = current.splice(from, 1);
    if (direction === "top") current.unshift(item);
    else if (direction === "up") current.splice(from - 1, 0, item);
    else current.splice(from + 1, 0, item);
    setReorderingId(repoId);
    await reorderRepos(current);
  }

  async function addProjectFromGitHub(fullName: string, defaultBranch: string) {
    setAddingRepo(fullName);
    try {
      const addRes = await fetch("/api/portfolio/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: fullName, branch: defaultBranch }),
      });
      const addData = await addRes.json();
      if (addData.repo?.id) {
        await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioRepoId: addData.repo.id }),
        });
      }
      router.refresh();
      setAvailableRepos((prev) => prev.filter((r) => r.fullName !== fullName));
    } finally {
      setAddingRepo(null);
    }
  }

  return (
    <div className="min-h-screen relative" style={paletteStyle}>
      <PortfolioBackground style={backgroundStyle} />
      {isUnpublished && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
          This portfolio is not public yet. Turn on <strong>Published</strong> in edit mode and save to share the link.
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
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? "Exit edit mode" : "Edit on page"}
            </Button>
          </div>
        )}
        {editMode && isOwner && (
          <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Section order (drag to reorder)</p>
            <ul className="space-y-1">
              {sectionOrderDraft.map((sectionId, index) => (
                <li
                  key={sectionId}
                  draggable
                  onDragStart={() => setDraggedSectionIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedSectionIndex === null || draggedSectionIndex === index) return;
                    setSectionOrderDraft((prev) => {
                      const next = [...prev];
                      const [removed] = next.splice(draggedSectionIndex, 1);
                      next.splice(index, 0, removed);
                      return next;
                    });
                    setDraggedSectionIndex(null);
                  }}
                  onDragEnd={() => setDraggedSectionIndex(null)}
                  className={`flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing ${draggedSectionIndex === index ? "opacity-50" : ""}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{SECTION_LABELS[sectionId] ?? sectionId}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-1.5">Save profile to apply order.</p>
          </div>
        )}
        {effectiveOrder.map((sectionId) => {
          if (sectionId === "profile")
            return (
        <section key="profile" className="flex flex-col md:flex-row gap-8 items-start mb-12">
          {(user.image || (editMode && isOwner && imageUrlDraft)) && (
            <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-border flex-shrink-0 bg-muted">
              <Image
                src={editMode && isOwner && imageUrlDraft ? imageUrlDraft : (user.image ?? "")}
                alt={user.name ?? ""}
                fill
                className="object-cover"
                unoptimized={editMode && isOwner && imageUrlDraft ? true : undefined}
                onError={(e) => {
                  if (editMode && isOwner) (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold">{editMode && isOwner ? displayNameDraft || "Your name" : user.name}</h1>
            {editMode && isOwner ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Display name</Label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Profile picture</Label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input
                      type="url"
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={imageUrlDraft}
                      onChange={(e) => { setImageUrlDraft(e.target.value); setAvatarUploadError(null); }}
                      placeholder="https://... or upload below"
                    />
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAvatarUploadError(null);
                        setAvatarUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const res = await fetch("/api/portfolio/avatar/upload", { method: "POST", body: formData });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            setImageUrlDraft(data.url);
                          } else {
                            setAvatarUploadError(data.error ?? "Upload failed");
                          }
                        } catch {
                          setAvatarUploadError("Upload failed");
                        } finally {
                          setAvatarUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={avatarUploading}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload from computer"}
                    </Button>
                  </div>
                  {avatarUploadError && <p className="mt-1 text-xs text-destructive">{avatarUploadError}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">Paste an image URL or upload a file (PNG, JPEG, GIF, WebP, SVG, max 5 MB).</p>
                </div>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="A short bio about you..."
                />
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Portfolio URL</Label>
                  <div className="mt-1 flex items-center gap-1 rounded-md border border-input bg-background text-sm">
                    <span className="px-3 py-1.5 text-muted-foreground shrink-0">/</span>
                    <input
                      type="text"
                      className="min-w-0 flex-1 rounded-r-md border-0 bg-transparent px-0 py-1.5 text-sm focus:ring-0 focus-visible:ring-0"
                      value={slugDraft}
                      onChange={(e) => {
                        setSlugDraft(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                        setSlugError(null);
                      }}
                      placeholder="yourname"
                      disabled={isDemo}
                    />
                  </div>
                  {slugError && <p className="mt-1 text-xs text-destructive">{slugError}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your portfolio will be at <strong>/{slugDraft || "yourname"}</strong>. Letters, numbers, and hyphens only.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {SOCIAL_LINK_KEYS.map(({ key, label, placeholder }) => (
                    <label key={key} className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      <input
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        value={socialsDraft[key] ?? ""}
                        onChange={(e) => setSocialsDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                      />
                    </label>
                  ))}
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Background style</Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BACKGROUND_STYLES.map((s) => {
                      const selected = backgroundStyleDraft === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setBackgroundStyleDraft(s.value)}
                          className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                            selected ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted/70"
                          }`}
                        >
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold">
                            {s.label.charAt(0)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block font-medium truncate">{s.label}</span>
                            <span className="block text-[11px] text-muted-foreground truncate">{s.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Color palette</Label>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getPaletteIds().map((id) => {
                      const p = COLOR_PALETTES[id];
                      const selected = colorPaletteDraft === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setColorPaletteDraft(id)}
                          className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left text-sm transition-colors ${selected ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted/70"}`}
                        >
                          <span
                            className="h-6 w-6 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: p.swatch }}
                            aria-hidden
                          />
                          <span className="truncate">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="publish-inline" className="text-sm">Published</Label>
                  <Switch
                    id="publish-inline"
                    checked={isPublishedDraft}
                    onCheckedChange={setIsPublishedDraft}
                  />
                </div>
                <Button size="sm" onClick={saveProfileInline} disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save profile"}
                </Button>
              </div>
            ) : (
              <>
                {bio && <p className="text-muted-foreground mb-1">{bio}</p>}
                <div className="flex flex-wrap gap-4 text-sm mt-2">
                  {SOCIAL_LINK_KEYS.map(({ key, label }) => {
                    const value = socials[key]?.trim();
                    if (!value) return null;
                    const Icon = SOCIAL_ICONS[key];
                    const href = key === "email" ? `mailto:${value}` : value;
                    return (
                      <a
                        key={key}
                        href={href}
                        target={key === "email" ? undefined : "_blank"}
                        rel={key === "email" ? undefined : "noopener noreferrer"}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        {Icon && <Icon className="h-4 w-4" />} {key === "email" ? value : label}
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
            );
          if (sectionId === "contributions")
            return (showCommitsGraph || showLanguagesGraph) ? (
          <section key="contributions" className="mb-12">
            <h2 className="text-xl font-semibold mb-1">Contributions & languages</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {commitsTimeRange === "all"
                ? "All-time contributions and language breakdown across your GitHub"
                : "Contributions (last 12 months) and language breakdown across your GitHub repos"}
              {editMode && isOwner && (showCommitsGraph || showLanguagesGraph) && (
                <span className="block mt-1 text-xs">Drag cards to swap their positions.</span>
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {effectiveChartOrder
                .filter((id) => (id === "evolution" && showCommitsGraph) || (id === "languages" && showLanguagesGraph))
                .map((chartId) => {
                  const isEvolution = chartId === "evolution";
                  const CardWrapper = (
                    <Card
                      key={chartId}
                      className={`relative ${editMode && isOwner ? "cursor-grab active:cursor-grabbing" : ""} ${draggedChartId === chartId ? "opacity-50" : ""}`}
                      draggable={editMode && isOwner}
                      onDragStart={() => editMode && isOwner && setDraggedChartId(chartId)}
                      onDragOver={(e) => { e.preventDefault(); if (editMode && isOwner) e.currentTarget.classList.add("ring-2", "ring-primary/50"); }}
                      onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary/50"); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("ring-2", "ring-primary/50");
                        if (!editMode || !isOwner || !draggedChartId || draggedChartId === chartId) return;
                        setContributionsChartOrderDraft((prev) => {
                          const fromIdx = prev.indexOf(draggedChartId);
                          const toIdx = prev.indexOf(chartId);
                          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
                          const next = [...prev];
                          next.splice(fromIdx, 1);
                          next.splice(toIdx, 0, draggedChartId);
                          return next;
                        });
                        setDraggedChartId(null);
                      }}
                      onDragEnd={() => setDraggedChartId(null)}
                    >
                      {isEvolution ? (
                        <>
                          {editMode && isOwner && (
                            <button
                              type="button"
                              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-lg font-medium text-muted-foreground hover:bg-muted hover:text-foreground z-10"
                              onClick={() => setShowCommitsGraph(false)}
                              aria-label="Remove contributions graph"
                            >
                              ×
                            </button>
                          )}
                          <CardContent className="pt-6">
                            <EvolutionGraph data={evolution} />
                          </CardContent>
                        </>
                      ) : (
                        <>
                          {editMode && isOwner && (
                            <button
                              type="button"
                              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-lg font-medium text-muted-foreground hover:bg-muted hover:text-foreground z-10"
                              onClick={() => setShowLanguagesGraph(false)}
                              aria-label="Remove languages chart"
                            >
                              ×
                            </button>
                          )}
                          <CardContent className="pt-6">
                            <LanguageChart data={languages} />
                          </CardContent>
                        </>
                      )}
                    </Card>
                  );
                  return CardWrapper;
                })}
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
                {!showDeveloperJourney && (
                  <button
                    type="button"
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 hover:bg-muted hover:text-foreground"
                    onClick={() => setShowDeveloperJourney(true)}
                  >
                    + Add developer journey
                  </button>
                )}
              </div>
            )}
          </section>
            ) : null;
          if (sectionId === "developer_journey")
            return showDeveloperJourney && (developerTimeline.length > 0 || (editMode && isOwner)) ? (
          <section key="developer_journey" className="mb-12">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h2 className="text-xl font-semibold">Developer journey</h2>
              {editMode && isOwner && (
                <button
                  type="button"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background/80 text-lg font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setShowDeveloperJourney(false)}
                  aria-label="Remove developer journey"
                >
                  ×
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {developerTimeline.length > 0
                ? githubJoinDate && githubUsername
                  ? `From when ${githubUsername} joined GitHub to today.`
                  : "A timeline of your GitHub activity over the years."
                : "Your developer journey will appear here when you have repos connected."}
            </p>

            {editMode && isOwner && (
              <Card className="mb-8 border-dashed">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-3">Add career event</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Add jobs, education, hackathons, or other milestones not on GitHub.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Date (year or YYYY-MM)</Label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newCareerDate}
                        onChange={(e) => setNewCareerDate(e.target.value)}
                        placeholder="2024 or 2024-06"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <select
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newCareerKind}
                        onChange={(e) => setNewCareerKind(e.target.value)}
                      >
                        {CAREER_KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Title</Label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newCareerTitle}
                        onChange={(e) => setNewCareerTitle(e.target.value)}
                        placeholder="e.g. Started at Acme Inc."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Description (optional)</Label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newCareerSubtitle}
                        onChange={(e) => setNewCareerSubtitle(e.target.value)}
                        placeholder="e.g. Full-stack developer"
                      />
                    </div>
                    <div>
                      <Button size="sm" onClick={createCareerEntry} disabled={addingCareer || !newCareerTitle.trim()}>
                        {addingCareer ? "Adding…" : "Add event"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {editingCareerId && (
              <Card className="mb-8 border-primary/50">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-3">Edit career event</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Date</Label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editCareerDraft.date}
                        onChange={(e) => setEditCareerDraft((p) => ({ ...p, date: e.target.value }))}
                        placeholder="2024-06"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <select
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editCareerDraft.kind}
                        onChange={(e) => setEditCareerDraft((p) => ({ ...p, kind: e.target.value }))}
                      >
                        {CAREER_KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Title</Label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editCareerDraft.title}
                        onChange={(e) => setEditCareerDraft((p) => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Description</Label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={editCareerDraft.subtitle}
                        onChange={(e) => setEditCareerDraft((p) => ({ ...p, subtitle: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => editingCareerId && saveCareerEntry(editingCareerId)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCareerId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {developerTimeline.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                Connect repos from the dashboard to build your timeline.
              </p>
            ) : (
              <>
            {/* Mobile: simple left-side timeline */}
            <div className="space-y-4 border-l-2 border-primary/50 dark:border-primary pl-4 md:hidden">
              {developerTimeline.map((entry, index) => {
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
                  <AnimateInView key={entry.id} animation="fadeUp" delay={index * 40}>
                  <div className="relative pl-4">
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
                      {entry.kind === "custom" && entry.customKind && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                          {CAREER_KIND_LABELS[entry.customKind] ?? entry.customKind}
                        </p>
                      )}
                      {entry.kind === "custom" && editMode && isOwner && (
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="secondary" className="h-6 text-xs" onClick={() => startEditingCareer(entry)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => deleteCareerEntry(entry.id)}>
                            Remove
                          </Button>
                        </div>
                      )}
                      {entry.kind === "repo" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.language && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTechBadgeClassName(entry.language)}`}>
                              {entry.language}
                            </span>
                          )}
                          {Array.isArray(entry.stack) &&
                            entry.stack.slice(0, 3).map((tech) => (
                              <span
                                key={tech}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTechBadgeClassName(tech)}`}
                              >
                                {tech}
                              </span>
                            ))}
                          {typeof entry.stars === "number" && entry.stars > 0 && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTechBadgeClassName("Stars")}`}>
                              ★ {entry.stars}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </AnimateInView>
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
                    <AnimateInView key={entry.id} animation="fadeUp" delay={index * 50}>
                    <div className="relative grid grid-cols-2 gap-10">
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
                            isEditMode={editMode && !!isOwner}
                            onDelete={editMode && isOwner ? deleteCareerEntry : undefined}
                            onEdit={editMode && isOwner ? startEditingCareer : undefined}
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
                            isEditMode={editMode && !!isOwner}
                            onDelete={editMode && isOwner ? deleteCareerEntry : undefined}
                            onEdit={editMode && isOwner ? startEditingCareer : undefined}
                          />
                        )}
                      </div>
                    </div>
                    </AnimateInView>
                  );
                })}
              </div>
            </div>
              </>
            )}
          </section>
            ) : null;
          if (sectionId === "projects")
            return (
        <section key="projects" className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Projects</h2>
              {editMode && isOwner && repos.length > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Drag projects to reorder, or use the pin and arrow buttons. First 4 appear at the top.
                </p>
              )}
            </div>
            {editMode && isOwner && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => (showAddProject ? setShowAddProject(false) : openAddProject())}
                >
                  <Plus className="h-4 w-4" />
                  Add project
                </Button>
                {showAddProject && (
                  <div className="rounded-md border border-border bg-card p-2 shadow-lg max-h-64 overflow-auto min-w-[280px]">
                    {availableRepos.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-2 py-4">
                        All your GitHub repos are already in your portfolio.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {availableRepos.map((r) => (
                          <li key={r.fullName} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/60">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{r.fullName}</p>
                              {r.description && (
                                <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="shrink-0 h-7"
                              disabled={addingRepo === r.fullName}
                              onClick={() => addProjectFromGitHub(r.fullName, r.defaultBranch)}
                            >
                              {addingRepo === r.fullName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {repos.map((repo, index) => {
            const title = repo.customTitle ?? repo.repoFullName.split("/")[1];
            const repoName = repo.repoFullName.split("/").pop() ?? title;
            const projectHref = `/${portfolio.slug}/${encodeURIComponent(repoName)}`;
            const summary = repo.customSummary ?? "No description.";
            const stack = repo.detectedStackJson ? (JSON.parse(repo.detectedStackJson) as string[]) : [];
            const summaryDraft = repoSummaries[repo.id] ?? summary;
            const isPinnedTop4 = index < 4;
            const isReordering = reorderingId === repo.id;
            return (
              <Card
                key={repo.id}
                className={
                  editMode
                    ? `transition-colors border-dashed border-border ${draggedProjectId === repo.id ? "opacity-50" : ""} ${editMode && isOwner ? "cursor-grab active:cursor-grabbing" : ""}`
                    : "transition-colors hover:bg-muted/50 cursor-pointer"
                }
                draggable={editMode && isOwner}
                onDragStart={() => editMode && isOwner && setDraggedProjectId(repo.id)}
                onDragOver={(e) => { e.preventDefault(); if (editMode && isOwner && draggedProjectId && draggedProjectId !== repo.id) e.currentTarget.classList.add("ring-2", "ring-primary/30"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-primary/30")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary/30");
                  if (editMode && isOwner && draggedProjectId) moveProjectToIndex(draggedProjectId, index);
                }}
                onDragEnd={() => setDraggedProjectId(null)}
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
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold hover:underline">{title}</h3>
                      {editMode && isOwner && isPinnedTop4 && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          Pinned #{index + 1}
                        </span>
                      )}
                    </div>
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
                  {editMode && isOwner && (
                    <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Pin to top"
                        disabled={index === 0 || isReordering}
                        onClick={() => moveProject(repo.id, "top")}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Move up"
                        disabled={index === 0 || isReordering}
                        onClick={() => moveProject(repo.id, "up")}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Move down"
                        disabled={index === repos.length - 1 || isReordering}
                        onClick={() => moveProject(repo.id, "down")}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
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
                          size="sm"
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
                          size="sm"
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
                        <Badge key={s} variant="outline" className={getTechBadgeClassName(s)}>
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
            );
          return null;
        })}
      </main>
    </div>
  );
}
