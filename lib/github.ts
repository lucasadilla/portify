const GITHUB_API = "https://api.github.com";

const mapRawToRepo = (r: RawRepo): GitHubRepo => ({
  id: r.id,
  fullName: r.full_name,
  name: r.name,
  description: r.description,
  defaultBranch: r.default_branch ?? "main",
  private: r.private,
  htmlUrl: r.html_url,
  language: r.language,
  stargazersCount: r.stargazers_count,
  pushedAt: r.pushed_at,
  createdAt: r.created_at,
});

export async function getGitHubRepos(accessToken: string): Promise<GitHubRepo[]> {
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error("Failed to fetch repos");
  const data = await res.json();
  return data.map((r: RawRepo) => mapRawToRepo(r));
}

/** Fetch all public repos across all pages (for portfolio sync). */
export async function getAllGitHubRepos(accessToken: string): Promise<GitHubRepo[]> {
  const all: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };
  while (true) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=${perPage}&sort=updated&page=${page}`,
      { headers }
    );
    if (!res.ok) throw new Error("Failed to fetch repos");
    const data = (await res.json()) as RawRepo[];
    const mapped = data.map((r) => mapRawToRepo(r));
    all.push(...mapped.filter((r) => !r.private));
    if (mapped.length < perPage) break;
    page += 1;
  }
  return all;
}

export async function getGitHubUserProfile(
  accessToken: string
): Promise<{ login: string; createdAt: string; htmlUrl: string }> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch GitHub user profile");
  }
  const data = await res.json();
  return {
    login: data.login,
    createdAt: data.created_at,
    htmlUrl: data.html_url,
  };
}

export async function getRepoLanguages(accessToken: string, owner: string, repo: string): Promise<Record<string, number>> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) return {};
  return await res.json();
}

/** Full commit history for a single repo: all years via Search API, then falls back to Stats API (last 52 weeks). */
export async function getRepoCommitHistory(
  accessToken: string,
  owner: string,
  repo: string
): Promise<CommitActivity[]> {
  const byMonth: Record<string, number> = {};
  const perPage = 100;
  const maxPagesPerYear = 10;
  const currentYear = new Date().getFullYear();
  const startYear = 2008;
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const searchYear = async (year: number): Promise<boolean> => {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const q = `repo:${owner}/${repo} committer-date:${from}..${to}`;
    for (let page = 1; page <= maxPagesPerYear; page++) {
      const url = `${GITHUB_API}/search/commits?q=${encodeURIComponent(
        q
      )}&sort=committer-date&order=asc&per_page=${perPage}&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return false;
      const data = (await res.json()) as { items?: { commit?: { author?: { date?: string } } }[] };
      const items = data.items ?? [];
      if (items.length === 0) return true;
      parseCommitItemsIntoByMonth(items, byMonth);
      if (items.length < perPage) return true;
    }
    return true;
  };

  for (let year = startYear; year <= currentYear; year++) {
    const ok = await searchYear(year);
    if (!ok) await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => setTimeout(r, 200));
  }

  // If Search API fails or returns nothing, fall back to Stats API (52 weeks).
  if (Object.keys(byMonth).length === 0) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/stats/commit_activity`;
    const opts = { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" } };
    let res = await fetch(url, opts);
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await fetch(url, opts);
    }
    if (res.ok) {
      const data = (await res.json()) as { week: number; total: number }[] | null;
      if (Array.isArray(data) && data.length > 0) {
        for (const w of data) {
          if (w.week == null || w.total == null) continue;
          const date = new Date(w.week * 1000);
          const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
          byMonth[month] = (byMonth[month] ?? 0) + w.total;
        }
      }
    }
  }

  return Object.entries(byMonth)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function parseCommitItemsIntoByMonth(
  items: { commit?: { author?: { date?: string } } }[],
  byMonth: Record<string, number>
): void {
  for (const item of items) {
    const dateStr = item.commit?.author?.date;
    if (!dateStr) continue;
    const month = dateStr.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }
}

/** Full contribution history: commits by this user across their whole GitHub history. Uses Search API year-by-year, then falls back to last 1000 commits. */
export async function getContributionHistoryByAuthor(
  accessToken: string,
  username: string
): Promise<CommitActivity[]> {
  const byMonth: Record<string, number> = {};
  const perPage = 100;
  const maxPagesPerYear = 10;
  const currentYear = new Date().getFullYear();
  const startYear = 2008;
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const searchYear = async (year: number, q: string): Promise<boolean> => {
    for (let page = 1; page <= maxPagesPerYear; page++) {
      const url = `${GITHUB_API}/search/commits?q=${encodeURIComponent(q)}&sort=author-date&order=asc&per_page=${perPage}&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return false;
      const data = (await res.json()) as { items?: { commit?: { author?: { date?: string } } }[] };
      const items = data.items ?? [];
      if (items.length === 0) return true;
      parseCommitItemsIntoByMonth(items, byMonth);
      if (items.length < perPage) return true;
    }
    return true;
  };

  for (let year = startYear; year <= currentYear; year++) {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const qRange = `author:${username} author-date:${from}..${to}`;
    const qGteLte = `author:${username} author-date:>=${from} author-date:<=${to}`;
    let ok = await searchYear(year, qRange);
    if (!ok) ok = await searchYear(year, qGteLte);
    if (!ok) await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => setTimeout(r, 350));
  }

  if (Object.keys(byMonth).length === 0) {
    const q = `author:${username}`;
    for (let page = 1; page <= 10; page++) {
      const url = `${GITHUB_API}/search/commits?q=${encodeURIComponent(q)}&sort=author-date&order=desc&per_page=${perPage}&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) break;
      const data = (await res.json()) as { items?: { commit?: { author?: { date?: string } } }[] };
      const items = data.items ?? [];
      if (items.length === 0) break;
      parseCommitItemsIntoByMonth(items, byMonth);
      if (items.length < perPage) break;
    }
  }

  return Object.entries(byMonth)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

/** Fetches contribution history from GraphQL (same data as profile contribution graph). Returns contributions by month. */
export async function getContributionHistoryFromGraphQL(
  accessToken: string,
  username: string
): Promise<CommitActivity[]> {
  const byMonth: Record<string, number> = {};
  const currentYear = new Date().getFullYear();
  const startYear = 2008;

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  for (let year = startYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    const res = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login: username, from, to } }),
    });
    if (!res.ok) continue;
    const body = await res.json();
    const weeks: { contributionDays?: { date: string; contributionCount: number }[] }[] =
      body?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
    for (const week of weeks) {
      for (const day of week.contributionDays ?? []) {
        const month = day.date.slice(0, 7);
        byMonth[month] = (byMonth[month] ?? 0) + (day.contributionCount ?? 0);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return Object.entries(byMonth)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  language: string | null;
  stargazersCount: number;
  pushedAt: string;
  createdAt: string;
}

export interface CommitActivity {
  month: string;
  count: number;
}

interface RawRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  created_at: string;
}
