import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAccessTokenForUser } from "@/lib/session";
import {
  getGitHubUserProfile,
  getContributionHistoryFromGraphQL,
  getGitHubRepos,
  getRepoLanguages,
} from "@/lib/github";
import type { GitHubRepo } from "@/lib/github";
import { PortfolioView } from "@/app/u/[username]/PortfolioView";
import {
  DEMO_PORTFOLIO,
  DEMO_EVOLUTION,
  DEMO_LANGUAGES,
  DEMO_DEVELOPER_TIMELINE,
} from "@/lib/demoData";

const MAX_REPOS_FOR_GRAPHS = 30;

function toOneSentence(text: string, maxLength = 180): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const match = cleaned.match(/(.+?[.!?])(\s|$)/);
  const sentence = (match ? match[1] : cleaned).trim();
  if (sentence.length <= maxLength) return sentence;
  const truncated = sentence.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${truncated}…`;
}

const RESERVED_SLUGS = new Set(["api", "generate", "settings", "auth"]);

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugParam } = await params;
  const slug = slugParam.toLowerCase().trim();
  if (RESERVED_SLUGS.has(slug)) notFound();

  const viewerSession = await getServerSession(authOptions);
  const viewerUsername = viewerSession?.user?.username ?? viewerSession?.user?.name ?? null;
  type PortfolioWithRelations = Prisma.PortfolioGetPayload<{
    include: {
      user: true;
      timelineEntries: true;
      repos: { include: { artifacts: true } };
    };
  }>;
  let portfolio: PortfolioWithRelations | null;
  try {
    portfolio = await prisma.portfolio.findUnique({
      where: { slug },
      include: {
        user: true,
        timelineEntries: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] },
        repos: {
          where: { status: "DONE" },
          orderBy: { pinnedOrder: "asc" },
          include: { artifacts: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timelineEntries")) {
      portfolio = await prisma.portfolio.findUnique({
        where: { slug },
        include: {
          user: true,
          repos: {
            where: { status: "DONE" },
            orderBy: { pinnedOrder: "asc" },
            include: { artifacts: true },
          },
        },
      }) as typeof portfolio;
      if (portfolio) (portfolio as { timelineEntries: unknown[] }).timelineEntries = [];
    } else {
      throw err;
    }
  }

  if (!portfolio) {
    if (slug === "demo") {
      return (
        <PortfolioView
          portfolio={DEMO_PORTFOLIO}
          evolutionData={DEMO_EVOLUTION}
          languageData={DEMO_LANGUAGES}
          developerTimeline={DEMO_DEVELOPER_TIMELINE}
          commitsTimeRange="year"
        />
      );
    }
    const viewerSlug =
      viewerSession?.user?.username?.trim()
        ? viewerSession.user.username.replace(/\s+/g, "-").toLowerCase()
        : null;
    if (viewerSlug && slug === viewerSlug) {
      redirect("/generate");
    }
    notFound();
  }

  const isUnpublished = !portfolio.isPublished;

  const socials = portfolio.socialsJson ? JSON.parse(portfolio.socialsJson) : {};

  const isOwner = viewerSession?.user?.id === portfolio.userId;

  // Accurate GitHub-based graphs, but limited and cached per request to keep things reasonable.
  let evolutionData: { month: string; commits: number }[] = [];
  let languageData: { name: string; value: number }[] = [];
  let commitsTimeRange: "all" | "year" = "year";

  let developerTimeline: {
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
  }[] = [];

  let githubJoinDate: string | null = null;
  let githubLogin: string | null = null;
  const token = await getAccessTokenForUser(portfolio.userId);
  const githubUsername = portfolio.user.username ?? null;

  if (token) {
    try {
      const profile = await getGitHubUserProfile(token);
      githubJoinDate = profile.createdAt;
      githubLogin = profile.login;
    } catch {
      githubLogin = githubUsername;
    }

    const loginForHistory = githubLogin ?? githubUsername;
    if (loginForHistory) {
      try {
        const profileHistory = await getContributionHistoryFromGraphQL(token, loginForHistory);
        if (profileHistory.length > 0) {
          evolutionData = profileHistory
            .map(({ month, count }) => ({ month, commits: count }))
            .sort((a, b) => a.month.localeCompare(b.month));
        }
      } catch {
        // ignore GraphQL failures
      }
    }

    if (evolutionData.length > 0) {
      const now = new Date();
      const nowMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const joinMonth = githubJoinDate ? githubJoinDate.slice(0, 7) : null;
      evolutionData = evolutionData.filter(({ month }) => {
        if (month > nowMonth) return false;
        if (joinMonth && month < joinMonth) return false;
        return true;
      });
      commitsTimeRange = "year";
    }

    let reposForGraphs: GitHubRepo[] = [];
    try {
      reposForGraphs = await getGitHubRepos(token);
    } catch {
      reposForGraphs = [];
    }

    const reposSlice = reposForGraphs.slice(0, MAX_REPOS_FOR_GRAPHS);
    const langBytes: Record<string, number> = {};
    const langResults = await Promise.allSettled(
      reposSlice.map(async (repo) => {
        const [owner, repoName] = repo.fullName.split("/");
        return owner && repoName ? getRepoLanguages(token, owner, repoName) : {};
      })
    );
    for (const r of langResults) {
      if (r.status === "fulfilled") {
        for (const [lang, bytes] of Object.entries(r.value) as [string, number][]) {
          langBytes[lang] = (langBytes[lang] ?? 0) + bytes;
        }
      }
    }
    const total = Object.values(langBytes).reduce((a, b) => a + b, 0);
    if (total > 0) {
      languageData = Object.entries(langBytes)
        .map(([name, value]) => ({ name, value: Math.round((value / total) * 100) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
  }
  const commitsTimeRange: "all" | "year" = "year";

  const developerTimeline: {
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
  }[] = [];

  // Basic repo-based timeline items from our own DB
  for (const r of portfolio.repos) {
    const created = r.createdAt;
    const dateIso =
      typeof created === "string" ? created : created instanceof Date ? created.toISOString() : new Date().toISOString();
    const year = Number.parseInt(dateIso.slice(0, 4), 10) || new Date().getFullYear();
    const stack =
      r.detectedStackJson && r.detectedStackJson.trim().length > 0
        ? (JSON.parse(r.detectedStackJson) as string[])
        : [];
    const rawDescription =
      (r.customSummary && r.customSummary.trim().length > 0 ? r.customSummary : null) ?? r.repoFullName;
    const description = toOneSentence(rawDescription);

    developerTimeline.push({
      kind: "repo",
      id: r.id,
      date: dateIso.slice(0, 10),
      year,
      title: r.repoFullName.split("/").pop() ?? r.repoFullName,
      subtitle: description,
      repoFullName: r.repoFullName,
      language: null,
      stars: undefined,
      hasProjectPage: true,
      stack,
    });
  }

  // Custom timeline entries authored in the app
  const customEntries = (portfolio.timelineEntries ?? []).map((e) => ({
    kind: "custom" as const,
    id: e.id,
    date: e.date,
    year: e.year,
    title: e.title,
    subtitle: e.subtitle ?? null,
    customKind: e.kind,
  }));
  developerTimeline.push(...customEntries);
  developerTimeline.sort((a, b) => a.date.localeCompare(b.date));

  const githubJoinDate: string | null = null;
  const githubLogin: string | null = null;
  const githubUsername = portfolio.user.username ?? null;

  return (
    <PortfolioView
      portfolio={{
        slug: portfolio.slug,
        bio: portfolio.bio,
        theme: portfolio.theme,
        backgroundStyle: (portfolio as { backgroundStyle?: string }).backgroundStyle ?? "minimal",
        displayName: (portfolio as { displayName?: string | null }).displayName ?? null,
        imageUrl: (portfolio as { imageUrl?: string | null }).imageUrl ?? null,
        sectionOrder: (portfolio as { sectionOrderJson?: string | null }).sectionOrderJson
          ? (JSON.parse((portfolio as { sectionOrderJson: string }).sectionOrderJson) as string[])
          : undefined,
        contributionsChartOrder: (portfolio as { contributionsChartOrderJson?: string | null }).contributionsChartOrderJson
          ? (JSON.parse((portfolio as { contributionsChartOrderJson: string }).contributionsChartOrderJson) as string[])
          : undefined,
        colorPalette: (portfolio as { colorPalette?: string | null }).colorPalette ?? undefined,
        socials,
        user: {
          name:
            (portfolio as { displayName?: string | null }).displayName
            ?? portfolio.user.name
            ?? portfolio.user.username
            ?? "Developer",
          image:
            (portfolio as { imageUrl?: string | null }).imageUrl
            ?? portfolio.user.avatarUrl
            ?? portfolio.user.image,
          email: portfolio.user.email,
        },
        repos: portfolio.repos.map((r) => ({
          id: r.id,
          repoFullName: r.repoFullName,
          customTitle: r.customTitle,
          customSummary: r.customSummary,
          detectedStackJson: r.detectedStackJson,
          artifacts: r.artifacts,
        })),
      }}
      isUnpublished={isUnpublished}
      isPublished={portfolio.isPublished}
      evolutionData={evolutionData}
      languageData={languageData}
      commitsTimeRange={commitsTimeRange}
      developerTimeline={developerTimeline}
      githubJoinDate={githubJoinDate}
      githubUsername={githubLogin ?? githubUsername}
      viewerUsername={viewerUsername}
      isOwner={isOwner}
    />
  );
}
