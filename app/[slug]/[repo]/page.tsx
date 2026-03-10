import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectPageView } from "@/app/u/[username]/[repo]/ProjectPageView";
import {
  getDemoRepoByName,
  DEMO_EVOLUTION,
  DEMO_LANGUAGES,
  DEMO_BACKGROUND_STYLE,
  DEMO_COLOR_PALETTE,
  DEMO_CONTRIBUTIONS_CHART_ORDER,
} from "@/lib/demoData";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; repo: string }>;
}) {
  const { slug, repo: repoSegment } = await params;
  const viewerSession = await getServerSession(authOptions);
  const viewerUsername = viewerSession?.user?.username ?? viewerSession?.user?.name ?? null;
  const slugNorm = slug.toLowerCase().trim();
  const repoName = decodeURIComponent(repoSegment);

  if (slugNorm === "demo") {
    const demoRepo = getDemoRepoByName(repoName);
    if (!demoRepo) notFound();
    const stack = demoRepo.detectedStackJson
      ? (JSON.parse(demoRepo.detectedStackJson) as string[])
      : [];
    const screenshots = demoRepo.artifacts
      .filter((a) => a.type === "screenshot")
      .map((a, i) => ({
        id: a.id,
        url: a.url,
        caption: ["Main interface", "Core feature", "Detail view"][i] ?? `Screenshot ${i + 1}`,
      }));
    const diagrams = demoRepo.artifacts
      .filter((a) => a.type === "diagram")
      .map((a) => ({
        id: a.id,
        url: a.url,
        description: null as string | null,
        kind: "kind" in a && typeof (a as { kind: string }).kind === "string" ? (a as { kind: string }).kind : undefined,
      }));
    return (
      <ProjectPageView
        portfolioSlug="demo"
        userName="Demo Developer"
        viewerUsername={viewerUsername}
        isOwner={false}
        backgroundStyle={DEMO_BACKGROUND_STYLE}
        colorPalette={DEMO_COLOR_PALETTE}
        contributionsChartOrder={DEMO_CONTRIBUTIONS_CHART_ORDER}
        repoId={demoRepo.id}
        repo={{
          title: demoRepo.customTitle,
          repoFullName: demoRepo.repoFullName,
          description: demoRepo.customSummary,
          projectWebsiteUrl: null,
          showCommitsGraph: true,
          showLanguagesGraph: true,
          showScreenshots: true,
          showDiagram: true,
          stack,
          commitData: DEMO_EVOLUTION,
          languageData: DEMO_LANGUAGES,
          screenshots,
          diagrams,
        }}
      />
    );
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { slug: slugNorm },
    include: {
      user: true,
      repos: {
        where: { status: "DONE" },
        orderBy: { pinnedOrder: "asc" },
        include: { artifacts: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!portfolio) notFound();

  const repo = portfolio.repos.find((r) => {
    const name = r.repoFullName.split("/").pop() ?? "";
    return name === repoName || name.toLowerCase() === repoName.toLowerCase();
  });

  if (!repo) notFound();

  // Do not call GitHub here – keep project page fast by relying only on precomputed data.
  const commitData: { month: string; commits: number }[] = [];
  const languageData: { name: string; value: number }[] = [];

  const stack = repo.detectedStackJson ? (JSON.parse(repo.detectedStackJson) as string[]) : [];
  const screenshots = repo.artifacts
    .filter((a) => a.type === "screenshot")
    .map((a) => {
      let caption: string | null = null;
      if (a.metadata) {
        try {
          caption = (JSON.parse(a.metadata) as { caption?: string }).caption ?? null;
        } catch {
          // ignore invalid metadata
        }
      }
      return { id: a.id, url: a.url, caption };
    });
  const diagrams = repo.artifacts
    .filter((a) => a.type === "diagram")
    .map((a) => {
      let description: string | null = null;
      let kind: string | undefined;
      if (a.metadata) {
        try {
          const m = JSON.parse(a.metadata) as { description?: string; diagramKind?: string; kind?: string };
          description = m.description ?? null;
          kind = m.diagramKind ?? m.kind;
        } catch {
          // ignore
        }
      }
      return { id: a.id, url: a.url, description, kind };
    });

  const defaultCaptions = [
    "Main interface and landing view",
    "Core feature or dashboard",
    "Detail view or workflow",
    "Settings or configuration",
    "Additional feature or screen",
  ];

  const isOwner = viewerSession?.user?.id === portfolio.userId;
  const repoForView = repo as typeof repo & {
    projectWebsiteUrl?: string | null;
    showCommitsGraph?: boolean;
    showLanguagesGraph?: boolean;
    showScreenshots?: boolean;
    showDiagram?: boolean;
  };
  const rawProjectWebsiteUrl =
    repoForView.projectWebsiteUrl ??
    (repo as Record<string, unknown>).projectWebsiteUrl ??
    null;
  const projectWebsiteUrl: string | null =
    typeof rawProjectWebsiteUrl === "string" ? rawProjectWebsiteUrl : null;

  const backgroundStyle = (portfolio as { backgroundStyle?: string }).backgroundStyle ?? "minimal";
  const colorPalette = (portfolio as { colorPalette?: string | null }).colorPalette ?? undefined;
  const contributionsChartOrder = (portfolio as { contributionsChartOrderJson?: string | null }).contributionsChartOrderJson
    ? (JSON.parse((portfolio as { contributionsChartOrderJson: string }).contributionsChartOrderJson) as string[])
    : undefined;

  return (
    <ProjectPageView
      portfolioSlug={portfolio.slug}
      userName={portfolio.user.name ?? portfolio.user.username ?? "Developer"}
      viewerUsername={viewerUsername}
      isOwner={!!isOwner}
      backgroundStyle={backgroundStyle}
      colorPalette={colorPalette}
      contributionsChartOrder={contributionsChartOrder}
      repoId={repo.id}
      repo={{
        title: repo.customTitle ?? repo.repoFullName.split("/")[1] ?? repoName,
        repoFullName: repo.repoFullName,
        description: repo.customSummary ?? "No description.",
        projectWebsiteUrl,
        showCommitsGraph: repoForView.showCommitsGraph ?? true,
        showLanguagesGraph: repoForView.showLanguagesGraph ?? true,
        showScreenshots: repoForView.showScreenshots ?? true,
        showDiagram: repoForView.showDiagram ?? true,
        stack,
        commitData,
        languageData,
        screenshots: screenshots.map((s, i) => ({
          id: s.id,
          url: s.url,
          caption: s.caption ?? defaultCaptions[i] ?? `Screenshot ${i + 1}`,
        })),
        diagrams,
      }}
    />
  );
}
