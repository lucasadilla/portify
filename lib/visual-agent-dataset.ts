/**
 * Maps Portify DB / cached JSON into rows for the Visual SQL Agent in-memory DB.
 */

import type { CommitActivity } from "@/lib/github";
import type { RepoSeed, UserSeed } from "@/lib/sql";

type RepoRow = {
  id: string;
  repoFullName: string;
  commitHistoryJson?: string | null;
  languageBreakdownJson?: string | null;
};

function topLanguage(languageBreakdownJson: string | null | undefined): string {
  if (!languageBreakdownJson) return "";
  try {
    const langs = JSON.parse(languageBreakdownJson) as { name: string; value: number }[];
    const sorted = [...langs].sort((a, b) => b.value - a.value);
    return sorted[0]?.name ?? "";
  } catch {
    return "";
  }
}

function monthlyFromJson(commitHistoryJson: string | null | undefined): { month: string; commits: number }[] {
  if (!commitHistoryJson) return [];
  try {
    return JSON.parse(commitHistoryJson) as { month: string; commits: number }[];
  } catch {
    return [];
  }
}

export function portfolioRepoToSeed(repo: RepoRow): RepoSeed {
  const name = repo.repoFullName.split("/").pop() ?? repo.repoFullName;
  const monthlyCommits = monthlyFromJson(repo.commitHistoryJson);
  const language = topLanguage(repo.languageBreakdownJson) || "Unknown";

  let lastCommitDate: string | null = null;
  for (let i = monthlyCommits.length - 1; i >= 0; i--) {
    if (monthlyCommits[i].commits > 0) {
      lastCommitDate = `${monthlyCommits[i].month}-01`;
      break;
    }
  }

  return {
    id: repo.id,
    name,
    language,
    stars: 0,
    forks: 0,
    lastCommitDate,
    monthlyCommits,
  };
}

export function buildProfileDataset(username: string | null | undefined, repos: RepoRow[]): {
  user: UserSeed;
  repoSeeds: RepoSeed[];
} {
  const user: UserSeed = {
    id: "u1",
    username: username?.trim() || "developer",
  };
  const repoSeeds = repos.map(portfolioRepoToSeed);
  return { user, repoSeeds };
}

/** Build a seed from live GitHub API results (commit activity + language bytes). */
export function liveRepoActivityToSeed(
  portfolioRepo: { id: string; repoFullName: string },
  activity: CommitActivity[],
  languageBytes: Record<string, number>
): RepoSeed {
  const name = portfolioRepo.repoFullName.split("/").pop() ?? portfolioRepo.repoFullName;
  const monthlyCommits = activity.map(({ month, count }) => ({ month, commits: count }));
  let lastCommitDate: string | null = null;
  for (let i = monthlyCommits.length - 1; i >= 0; i--) {
    if (monthlyCommits[i].commits > 0) {
      lastCommitDate = `${monthlyCommits[i].month}-01`;
      break;
    }
  }
  const total = Object.values(languageBytes).reduce((a, b) => a + b, 0);
  let language = "Unknown";
  if (total > 0) {
    const top = Object.entries(languageBytes).sort((a, b) => b[1] - a[1])[0];
    language = top?.[0] ?? "Unknown";
  }
  return {
    id: portfolioRepo.id,
    name,
    language,
    stars: 0,
    forks: 0,
    lastCommitDate,
    monthlyCommits,
  };
}
