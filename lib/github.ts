const GITHUB_API = "https://api.github.com";

export async function getGitHubRepos(accessToken: string): Promise<GitHubRepo[]> {
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error("Failed to fetch repos");
  const data = await res.json();
  return data.map((r: RawRepo) => ({
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
  }));
}

export async function getRepoLanguages(accessToken: string, owner: string, repo: string): Promise<Record<string, number>> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/languages`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) return {};
  return await res.json();
}

export async function getCommitActivity(accessToken: string, owner: string, repo: string): Promise<CommitActivity[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const byMonth: Record<string, number> = {};
  for (const c of data as { commit?: { author?: { date?: string } } }[]) {
    const date = c.commit?.author?.date;
    if (date) {
      const key = date.slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + 1;
    }
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
}
