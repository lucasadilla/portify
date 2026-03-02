import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAccessTokenForUser } from "@/lib/session";
import { getGitHubRepos, getCommitActivity, getRepoLanguages, getContributionHistoryFromGraphQL, getContributionHistoryByAuthor } from "@/lib/github";
import { PortfolioView } from "./PortfolioView";

const MAX_REPOS_FOR_GRAPHS = 40;

const DEMO_PORTFOLIO = {
  slug: "demo",
  bio: "Full-stack developer building with Next.js, TypeScript, and modern tooling. From commits to career.",
  theme: "dark",
  socials: { email: "demo@portify.dev", website: "https://portify.dev", linkedin: "https://linkedin.com/in/demo" },
  user: {
    name: "Demo Developer",
    image: "https://avatars.githubusercontent.com/u/1?v=4",
    email: "demo@portify.dev",
  },
  repos: [
    {
      id: "demo-1",
      repoFullName: "portify/portify",
      customTitle: "Portify",
      customSummary: "AI-powered developer portfolio infrastructure. Transforms GitHub repos into a live portfolio with AI summaries, tech stack detection, and evolution graphs.",
      detectedStackJson: JSON.stringify(["Next.js", "TypeScript", "Prisma", "TailwindCSS", "OpenAI"]),
      artifacts: [] as { id: string; type: string; url: string }[],
    },
  ],
};

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const slug = username.toLowerCase().trim();
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

  if (!portfolio) {
    if (slug === "demo") {
      return <PortfolioView portfolio={DEMO_PORTFOLIO} />;
    }
    notFound();
  }

  const isUnpublished = !portfolio.isPublished;

  const socials = portfolio.socialsJson ? JSON.parse(portfolio.socialsJson) : {};

  let evolutionData: { month: string; commits: number }[] = [];
  let languageData: { name: string; value: number }[] = [];
  let commitsTimeRange: "all" | "year" = "year";
  const token = await getAccessTokenForUser(portfolio.userId);
  const githubUsername = portfolio.user.username ?? null;

  if (token) {
    let reposForGraphs: { fullName: string }[] = [];
    try {
      reposForGraphs = await getGitHubRepos(token);
    } catch {
      reposForGraphs = portfolio.repos.map((r) => ({ fullName: r.repoFullName }));
    }
    const reposSlice = reposForGraphs.slice(0, MAX_REPOS_FOR_GRAPHS);

    if (githubUsername) {
      try {
        let contributionHistory = await getContributionHistoryFromGraphQL(token, githubUsername);
        if (contributionHistory.length === 0) {
          contributionHistory = await getContributionHistoryByAuthor(token, githubUsername);
        }
        if (contributionHistory.length > 0) {
          evolutionData = contributionHistory.map(({ month, count }) => ({ month, commits: count }));
          commitsTimeRange = "all";
        }
      } catch {
        // fall through to Stats API fallback
      }
    }

    if (evolutionData.length === 0) {
      const byMonth: Record<string, number> = {};
      const results = await Promise.allSettled(
        reposSlice.map((repo) => {
          const [owner, repoName] = repo.fullName.split("/");
          return owner && repoName ? getCommitActivity(token, owner, repoName) : Promise.resolve([]);
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled")
          for (const { month, count } of r.value) byMonth[month] = (byMonth[month] ?? 0) + count;
      }
      evolutionData = Object.entries(byMonth)
        .map(([month, commits]) => ({ month, commits }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }

    const langBytes: Record<string, number> = {};
    const langResults = await Promise.allSettled(
      reposSlice.map(async (repo) => {
        const [owner, repoName] = repo.fullName.split("/");
        return owner && repoName ? getRepoLanguages(token, owner, repoName) : {};
      })
    );
    for (const r of langResults) {
      if (r.status === "fulfilled")
        for (const [lang, bytes] of Object.entries(r.value)) langBytes[lang] = (langBytes[lang] ?? 0) + bytes;
    }
    const total = Object.values(langBytes).reduce((a, b) => a + b, 0);
    if (total > 0) {
      languageData = Object.entries(langBytes)
        .map(([name, value]) => ({ name, value: Math.round((value / total) * 100) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
  }

  return (
    <PortfolioView
      portfolio={{
        slug: portfolio.slug,
        bio: portfolio.bio,
        theme: portfolio.theme,
        socials,
        user: {
          name: portfolio.user.name ?? portfolio.user.username ?? "Developer",
          image: portfolio.user.avatarUrl ?? portfolio.user.image,
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
      evolutionData={evolutionData}
      languageData={languageData}
      commitsTimeRange={commitsTimeRange}
    />
  );
}
