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
  params: Promise<{ username: string; repo: string }>;
}) {
  const { username, repo: repoSegment } = await params;
  const viewerSession = await getServerSession(authOptions);
  const viewerUsername = viewerSession?.user?.username ?? viewerSession?.user?.name ?? null;
  const slug = username.toLowerCase().trim();
  const repoName = decodeURIComponent(repoSegment);

  const portfolio = await prisma.portfolio.findUnique({
    where: { slug },
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
      return { url: a.url, caption };
    });
  const diagram = repo.artifacts.find((a) => a.type === "diagram");

  const defaultCaptions = [
    "Main interface and landing view",
    "Core feature or dashboard",
    "Detail view or workflow",
    "Settings or configuration",
    "Additional feature or screen",
  ];

  return (
    <ProjectPageView
      portfolioSlug={portfolio.slug}
      userName={portfolio.user.name ?? portfolio.user.username ?? "Developer"}
      viewerUsername={viewerUsername}
      repo={{
        title: repo.customTitle ?? repo.repoFullName.split("/")[1] ?? repoName,
        repoFullName: repo.repoFullName,
        description: repo.customSummary ?? "No description.",
        stack,
        commitData,
        languageData,
        screenshots: screenshots.map((s, i) => ({
          url: s.url,
          caption: s.caption ?? defaultCaptions[i] ?? `Screenshot ${i + 1}`,
        })),
        diagramUrl: diagram?.url ?? null,
      }}
    />
  );
}
