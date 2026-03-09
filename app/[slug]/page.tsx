import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAccessTokenForUser } from "@/lib/session";
import {
  getGitHubRepos,
  getRepoLanguages,
  getContributionHistoryFromGraphQL,
  getContributionHistoryByAuthor,
  getGitHubUserProfile,
} from "@/lib/github";
import type { GitHubRepo } from "@/lib/github";
import { PortfolioView } from "@/app/u/[username]/PortfolioView";
import {
  DEMO_PORTFOLIO,
  DEMO_EVOLUTION,
  DEMO_LANGUAGES,
  DEMO_DEVELOPER_TIMELINE,
} from "@/lib/demoData";

const MAX_REPOS_FOR_GRAPHS = 40;

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

  let evolutionData: { month: string; commits: number }[] = [];
  let languageData: { name: string; value: number }[] = [];
  let commitsTimeRange: "all" | "year" = "all";
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
        // ignore
      }
    }

    if (evolutionData.length === 0 && loginForHistory) {
      try {
        const authorHistory = await getContributionHistoryByAuthor(token, loginForHistory);
        if (authorHistory.length > 0) {
          evolutionData = authorHistory
            .map(({ month, count }) => ({ month, commits: count }))
            .sort((a, b) => a.month.localeCompare(b.month));
        }
      } catch {
        // ignore
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
    }

    let reposForGraphs: GitHubRepo[] = [];
    try {
      reposForGraphs = await getGitHubRepos(token);
    } catch {
      reposForGraphs = (portfolio.repos.map((r) => ({
        id: r.id,
        fullName: r.repoFullName,
        name: r.repoFullName.split("/").pop() ?? r.repoFullName,
        description: null,
        defaultBranch: "main",
        private: false,
        htmlUrl: `https://github.com/${r.repoFullName}`,
        language: null,
        stargazersCount: 0,
        pushedAt: "",
        createdAt: "",
      })) as unknown) as GitHubRepo[];
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

    const portfolioRepoNames = new Set(
      portfolio.repos.map((r) => r.repoFullName.split("/").pop()?.toLowerCase()).filter(Boolean) as string[]
    );
    const portfolioRepoByFullName = new Map(
      portfolio.repos.map((r) => [r.repoFullName.toLowerCase(), r] as const)
    );

    if (githubJoinDate) {
      const joinYear = Number.parseInt(githubJoinDate.slice(0, 4), 10);
      if (!Number.isNaN(joinYear)) {
        developerTimeline.push({
          kind: "account",
          id: "github-account",
          date: githubJoinDate,
          year: joinYear,
          title: "Joined GitHub",
          subtitle: githubLogin ? `Created @${githubLogin}` : null,
        });
      }
    }

    for (const repo of reposForGraphs) {
      if (!repo.createdAt) continue;
      const createdYear = Number.parseInt(repo.createdAt.slice(0, 4), 10);
      if (Number.isNaN(createdYear)) continue;
      const portfolioMatch = portfolioRepoByFullName.get(repo.fullName.toLowerCase());
      if (!portfolioMatch) continue;
      const customSummary =
        portfolioMatch?.customSummary && portfolioMatch.customSummary.trim().length > 0
          ? portfolioMatch.customSummary
          : null;
      const rawDescription =
        customSummary ??
        (repo.description && repo.description.trim().length > 0 ? repo.description : repo.fullName);
      const description = toOneSentence(rawDescription);
      const stack =
        portfolioMatch?.detectedStackJson && portfolioMatch.detectedStackJson.trim().length > 0
          ? (JSON.parse(portfolioMatch.detectedStackJson) as string[])
          : [];

      developerTimeline.push({
        kind: "repo",
        id: String(repo.id),
        date: repo.createdAt,
        year: createdYear,
        title: repo.name,
        subtitle: description,
        repoFullName: repo.fullName,
        language: repo.language,
        stars: repo.stargazersCount,
        hasProjectPage: true,
        stack,
      });
    }

    developerTimeline.sort((a, b) => a.date.localeCompare(b.date));

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
  }

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
