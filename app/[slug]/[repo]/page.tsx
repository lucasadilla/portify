import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAccessTokenForUser } from "@/lib/session";
import { getRepoCommitHistory, getRepoLanguages } from "@/lib/github";
import { ProjectPageView } from "./ProjectPageView";

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

  const portfolio = await prisma.portfolio.findUnique({
    where: { slug: slugNorm },
    include: {
      user: true,
      repos: {
        where: { status: "DONE" },
        orderBy: { pinnedOrder: "asc" },
        include: { artifacts: true },
      },
    },
  });

  if (!portfolio) notFound();

  const repo = portfolio.repos.find((r) => {
    const name = r.repoFullName.split("/").pop() ?? "";
    return name === repoName || name.toLowerCase() === repoName.toLowerCase();
  });

  if (!repo) notFound();

  const [owner] = repo.repoFullName.split("/");
  let commitData: { month: string; commits: number }[] = [];
  let languageData: { name: string; value: number }[] = [];
  const token = await getAccessTokenForUser(portfolio.userId);
  if (token && owner) {
    try {
      const [activity, langs] = await Promise.all([
        getRepoCommitHistory(token, owner, repoName),
        getRepoLanguages(token, owner, repoName),
      ]);
      commitData = activity
        .map((a) => ({ month: a.month, commits: a.count }))
        .sort((a, b) => a.month.localeCompare(b.month));
      const total = Object.values(langs).reduce((a, b) => a + b, 0);
      if (total > 0) {
        languageData = Object.entries(langs)
          .map(([name, value]) => ({ name, value: Math.round((value / total) * 100) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }
    } catch {
      // use empty if API fails
    }
  }

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
      if (a.metadata) {
        try {
          description = (JSON.parse(a.metadata) as { description?: string }).description ?? null;
        } catch {
          // ignore
        }
      }
      return { id: a.id, url: a.url, description };
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
  const projectWebsiteUrl =
    repoForView.projectWebsiteUrl ??
    (repo as Record<string, unknown>).projectWebsiteUrl ?? null;

  return (
    <ProjectPageView
      portfolioSlug={portfolio.slug}
      userName={portfolio.user.name ?? portfolio.user.username ?? "Developer"}
      viewerUsername={viewerUsername}
      isOwner={!!isOwner}
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
