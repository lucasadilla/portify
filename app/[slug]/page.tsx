import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
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

  // Read cached GitHub graphs from DB (precomputed by worker).
  const evolutionData: { month: string; commits: number }[] =
    (portfolio as { contributionsJson?: string | null }).contributionsJson
      ? (JSON.parse((portfolio as { contributionsJson: string }).contributionsJson) as {
          month: string;
          commits: number;
        }[])
      : [];

  const languageData: { name: string; value: number }[] =
    (portfolio as { languagesJson?: string | null }).languagesJson
      ? (JSON.parse((portfolio as { languagesJson: string }).languagesJson) as {
          name: string;
          value: number;
        }[])
      : [];

  const commitsTimeRange: "all" | "year" = "year";

  // Developer journey: GitHub account + repos + custom entries
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

  const githubJoinDate =
    (portfolio as { githubJoinDate?: string | null }).githubJoinDate ?? null;
  const githubLogin = portfolio.user.username ?? null;

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
