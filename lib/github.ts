const GITHUB_API = "https://api.github.com";

/** GitHub rejects requests without a valid User-Agent (REST API requirement). */
const GITHUB_USER_AGENT =
  process.env.GITHUB_API_USER_AGENT ?? "Portify/1.0 (+https://github.com/octokit; Node.js fetch; visual-agent)";

export function githubHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": GITHUB_USER_AGENT,
  };
}

/** Next.js may cache GET fetches; GitHub responses must be fresh for repo lists and dates. */
const githubFetchInit = (accessToken: string): RequestInit => ({
  cache: "no-store",
  headers: githubHeaders(accessToken),
});

/** Ping GitHub — used to pick a working token (JWT vs DB) and validate OAuth. */
export async function verifyGithubAccessToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${GITHUB_API}/user`, {
      cache: "no-store",
      headers: githubHeaders(accessToken),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchGithubOrThrow(accessToken: string, url: string): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await fetch(url, githubFetchInit(accessToken));
    if (last.ok) return last;
    if (last.status === 401 || last.status === 403) {
      throw new Error(`GitHub API ${last.status}`);
    }
    if (last.status === 429 || (last.status >= 500 && last.status < 600)) {
      const ra = last.headers.get("retry-after");
      const sec = ra ? Math.min(60, Number(ra) || 1) : Math.min(10, attempt + 1);
      await new Promise((r) => setTimeout(r, sec * 1000));
      continue;
    }
    throw new Error(`GitHub API ${last.status}: ${url}`);
  }
  throw new Error(`GitHub API failed after retries: ${last?.status ?? "?"}`);
}

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

async function getAllGitHubReposPaged(accessToken: string, extraQuery: string): Promise<GitHubRepo[]> {
  const all: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const url = `${GITHUB_API}/user/repos?per_page=${perPage}&sort=updated&page=${page}${extraQuery}`;
    const res = await fetchGithubOrThrow(accessToken, url);
    const data = (await res.json()) as RawRepo[];
    const mapped = data.map((r) => mapRawToRepo(r));
    all.push(...mapped);
    if (mapped.length < perPage) break;
    page += 1;
  }
  return all;
}

/** First page only (up to 100) — used for language aggregation and fallbacks. */
export async function getGitHubRepos(accessToken: string): Promise<GitHubRepo[]> {
  const url = `${GITHUB_API}/user/repos?per_page=100&sort=updated&affiliation=${encodeURIComponent("owner,collaborator,organization_member")}`;
  const res = await fetchGithubOrThrow(accessToken, url);
  const data = (await res.json()) as RawRepo[];
  return data.map((r: RawRepo) => mapRawToRepo(r));
}

/** Fetch all accessible repos across all pages (owned, collaborator, org). */
export async function getAllGitHubRepos(accessToken: string): Promise<GitHubRepo[]> {
  const extra = `&affiliation=${encodeURIComponent("owner,collaborator,organization_member")}`;
  return getAllGitHubReposPaged(accessToken, extra);
}

/** Same as getAllGitHubRepos but without affiliation filter — fallback if the stricter query fails. */
export async function getAllGitHubReposRelaxed(accessToken: string): Promise<GitHubRepo[]> {
  return getAllGitHubReposPaged(accessToken, "");
}

/** Single repo — same fields as list (id, created_at, …). */
export async function fetchGitHubRepoByFullName(accessToken: string, repoFullName: string): Promise<GitHubRepo | null> {
  const parts = repoFullName.split("/").map((s) => s.trim());
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      githubFetchInit(accessToken)
    );
    if (!res.ok) return null;
    const data = (await res.json()) as RawRepo;
    return mapRawToRepo(data);
  } catch {
    return null;
  }
}

export type VisualAgentRepoSource = "github_list" | "github_first_page" | "github_per_repo" | "none";

/**
 * Full account repo list for the visual agent. Uses uncached fetches.
 * If paginated /user/repos fails, tries first page only, then per-repo GET for portfolio-linked names (real GitHub created_at).
 */
export async function fetchGitHubReposForVisualAgent(
  accessToken: string,
  portfolioReposForFallback: { repoFullName: string }[]
): Promise<{ repos: GitHubRepo[]; source: VisualAgentRepoSource }> {
  let all: GitHubRepo[] = [];
  try {
    all = await getAllGitHubRepos(accessToken);
  } catch {
    try {
      all = await getAllGitHubReposRelaxed(accessToken);
    } catch {
      all = [];
    }
  }
  if (all.length === 0) {
    try {
      all = await getAllGitHubReposRelaxed(accessToken);
    } catch {
      // ignore
    }
  }
  if (all.length > 0) return { repos: all, source: "github_list" };

  try {
    const page = await getGitHubRepos(accessToken);
    if (page.length > 0) return { repos: page, source: "github_first_page" };
  } catch {
    try {
      const relaxedPage = await getAllGitHubReposRelaxed(accessToken);
      if (relaxedPage.length > 0) return { repos: relaxedPage.slice(0, 100), source: "github_first_page" };
    } catch {
      // continue
    }
  }

  const perRepo: GitHubRepo[] = [];
  const slice = portfolioReposForFallback.slice(0, 80);
  const batchSize = 8;
  for (let i = 0; i < slice.length; i += batchSize) {
    const batch = slice.slice(i, i + batchSize);
    const settled = await Promise.all(batch.map((r) => fetchGitHubRepoByFullName(accessToken, r.repoFullName)));
    for (const repo of settled) {
      if (repo) perRepo.push(repo);
    }
  }
  if (perRepo.length > 0) return { repos: perRepo, source: "github_per_repo" };

  return { repos: [], source: "none" };
}

export async function getGitHubUserProfile(
  accessToken: string
): Promise<{ login: string; createdAt: string; htmlUrl: string }> {
  const res = await fetch(`${GITHUB_API}/user`, {
    cache: "no-store",
    headers: githubHeaders(accessToken),
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
    cache: "no-store",
    headers: githubHeaders(accessToken),
  });
  if (!res.ok) return {};
  return await res.json();
}

/** Normalize GitHub language bytes to percentages (0–100). */
export function languageBytesToPercentages(langs: Record<string, number>): { language: string; percentage: number }[] {
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return Object.entries(langs)
    .map(([language, bytes]) => ({ language, percentage: Math.round((bytes / total) * 100) }))
    .filter((r) => r.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Aggregate language bytes across repos (same approach as the portfolio worker).
 * Uses the user's accessible repos list (up to maxRepos).
 */
export async function getAccountLanguagePercentages(
  accessToken: string,
  maxRepos = 30
): Promise<{ language: string; percentage: number }[]> {
  let repos: GitHubRepo[] = [];
  try {
    repos = await getGitHubRepos(accessToken);
  } catch {
    return [];
  }
  const slice = repos.slice(0, maxRepos);
  const langBytes: Record<string, number> = {};
  const results = await Promise.allSettled(
    slice.map(async (repo) => {
      const [owner, repoName] = repo.fullName.split("/");
      return owner && repoName ? getRepoLanguages(accessToken, owner, repoName) : {};
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const [lang, bytes] of Object.entries(r.value) as [string, number][]) {
        langBytes[lang] = (langBytes[lang] ?? 0) + bytes;
      }
    }
  }
  return languageBytesToPercentages(langBytes).slice(0, 15);
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
  const headers = githubHeaders(accessToken);

  // (We start with Search; if that fails completely we'll fall back to Stats below.)

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

/**
 * Commits by this user (Search API year-by-year), then falls back to last pages of `author:` search.
 * @param sinceYear First calendar year to search (default 2008). Use a recent year for faster interactive routes.
 */
export async function getContributionHistoryByAuthor(
  accessToken: string,
  username: string,
  sinceYear: number = 2008
): Promise<CommitActivity[]> {
  const byMonth: Record<string, number> = {};
  const perPage = 100;
  const maxPagesPerYear = 10;
  const currentYear = new Date().getFullYear();
  const loopStart = Math.min(Math.max(2008, sinceYear), currentYear);
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

  for (let year = loopStart; year <= currentYear; year++) {
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
