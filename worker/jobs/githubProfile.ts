import { prisma } from "../../lib/db";
import { getAccessTokenForUser } from "../../lib/session";
import {
  getGitHubUserProfile,
  getContributionHistoryFromGraphQL,
  getGitHubRepos,
  getRepoLanguages,
  getRepoCommitHistory,
  type GitHubRepo,
} from "../../lib/github";

const MAX_REPOS_FOR_GRAPHS = 30;

export async function refreshPortfolioGitHubData(portfolioId: string, userId: string) {
  const token = await getAccessTokenForUser(userId);
  if (!token) return;

  let githubJoinDate: string | null = null;
  let githubLogin: string | null = null;

  try {
    const profile = await getGitHubUserProfile(token);
    githubJoinDate = profile.createdAt;
    githubLogin = profile.login;
  } catch {
    // ignore profile errors
  }

  let evolutionData: { month: string; commits: number }[] = [];
  const loginForHistory = githubLogin;
  if (loginForHistory) {
    try {
      const profileHistory = await getContributionHistoryFromGraphQL(token, loginForHistory);
      evolutionData = profileHistory
        .map(({ month, count }) => ({ month, commits: count }))
        .sort((a, b) => a.month.localeCompare(b.month));
    } catch {
      // ignore contribution errors
    }
  }

  let languageData: { name: string; value: number }[] = [];
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

  await prisma.portfolio.update({
    where: { id: portfolioId },
    data: {
      githubJoinDate,
      contributionsJson: evolutionData.length ? JSON.stringify(evolutionData) : null,
      languagesJson: languageData.length ? JSON.stringify(languageData) : null,
    },
  });
}

export async function refreshRepoGitHubData(portfolioRepoId: string) {
  const repo = await prisma.portfolioRepo.findUnique({
    where: { id: portfolioRepoId },
    include: { portfolio: true },
  });
  if (!repo?.portfolio) return;

  const token = await getAccessTokenForUser(repo.portfolio.userId);
  if (!token) return;

  const [owner, repoShortName] = repo.repoFullName.split("/");
  if (!owner || !repoShortName) return;

  try {
    const [activity, langs] = await Promise.all([
      getRepoCommitHistory(token, owner, repoShortName),
      getRepoLanguages(token, owner, repoShortName),
    ]);

    const commitData = activity
      .map((a) => ({ month: a.month, commits: a.count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const total = Object.values(langs).reduce((a, b) => a + b, 0);
    const languageData =
      total > 0
        ? Object.entries(langs)
            .map(([name, value]) => ({ name, value: Math.round((value / total) * 100) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
        : [];

    await prisma.portfolioRepo.update({
      where: { id: portfolioRepoId },
      data: {
        commitHistoryJson: commitData.length ? JSON.stringify(commitData) : null,
        languageBreakdownJson: languageData.length ? JSON.stringify(languageData) : null,
      },
    });
  } catch {
    // swallow GitHub errors; keep worker robust
  }
}

