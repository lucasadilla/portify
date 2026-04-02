/**
 * Visual SQL Agent — in-memory SQLite execution layer.
 * Data is seeded per request from Portify's cached GitHub fields (no cross-tenant persistence).
 */

import fs from "fs";
import path from "path";
/** In-memory DB handle from sql.js (no official types in package). */
export type SqliteDatabase = {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  run(sql: string, params?: unknown[]): void;
  close(): void;
};

/** Logical schema (SQLite) — keep in sync with prompts in agent.ts */
export const VISUAL_AGENT_DDL = `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL
);

CREATE TABLE repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  last_commit_date TEXT,
  created_at TEXT
);

CREATE TABLE commits (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (repo_id) REFERENCES repos(id)
);

-- Account-wide or repo-wide language mix (percent of bytes on GitHub). Use for pie charts.
CREATE TABLE language_shares (
  language TEXT PRIMARY KEY,
  percentage INTEGER NOT NULL
);

-- Scalar stats (e.g. total GitHub repo count from the API). Use for "how many repos" style questions.
CREATE TABLE account_stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`;

export const VISUAL_AGENT_SCHEMA_FOR_LLM = `
Tables (SQLite):

users(id, username)
repos(id, name, language, stars, forks, last_commit_date, created_at)  -- last_commit_date: last activity; created_at: when the repo was created on GitHub (gh_* rows), or when added to portfolio (pf_* rows), ISO YYYY-MM-DD
commits(id, repo_id, date, additions, deletions)             -- date is ISO date string YYYY-MM-DD
language_shares(language, percentage)                        -- percentage 0–100; aggregated from GitHub language bytes (account or single repo)
account_stats(key, value)                                      -- integer metrics; includes key 'github_repo_count' = total repositories on GitHub (when seeded)

Important: Rows are seeded from monthly GitHub aggregates (one row per repo per month).
For those rows, "additions" holds the monthly activity count (contributions or commits for that month, depending on source). "deletions" is unused (0).
To total activity over a date range use SUM(additions), not COUNT(*). COUNT(*) counts months, not activity.

For questions about programming languages, language mix, or pie charts of languages: query language_shares (SELECT language, percentage FROM language_shares ORDER BY percentage DESC). Do NOT use repos.language for account-level language pies — that column is a single label per repo, not a distribution.

For questions about how many GitHub repositories the user has (total only, not over time): use SELECT value FROM account_stats WHERE key = 'github_repo_count', or SELECT COUNT(*) AS n FROM repos WHERE id LIKE 'gh_%' OR id LIKE 'pf_%' (gh_ = from GitHub API; pf_ = portfolio fallback; id 'account' is synthetic for contribution history).

For questions about repositories created or opened over time, by month/year, or cumulative repos over time: use repos.created_at on rows where id LIKE 'gh_%' OR id LIKE 'pf_%'. Example: SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count FROM repos WHERE (id LIKE 'gh_%' OR id LIKE 'pf_%') AND created_at IS NOT NULL GROUP BY strftime('%Y-%m', created_at) ORDER BY month. Do NOT use account_stats for time series.

Relationships: commits.repo_id -> repos.id
`;

type SqlJsStatic = Awaited<ReturnType<typeof import("sql.js").default>>;

let sqlModulePromise: Promise<SqlJsStatic> | null = null;

async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModulePromise) {
    sqlModulePromise = (async () => {
      const init = (await import("sql.js")).default;
      const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
      const wasmBinary = fs.readFileSync(wasmPath);
      return init({ wasmBinary });
    })();
  }
  return sqlModulePromise;
}

export async function createEmptyAgentDatabase(): Promise<SqliteDatabase> {
  const SQL = await getSqlModule();
  const db = new SQL.Database();
  db.exec(VISUAL_AGENT_DDL);
  return db as SqliteDatabase;
}

export type RepoSeed = {
  id: string;
  name: string;
  language: string;
  stars: number;
  forks: number;
  lastCommitDate: string | null;
  monthlyCommits: { month: string; commits: number }[];
};

export type UserSeed = { id: string; username: string };

/**
 * Insert one row per month per repo from monthly buckets.
 * `additions` stores the real monthly count (GitHub contributions or commit count); do not scale it.
 */
export function seedAgentDatabase(
  db: SqliteDatabase,
  user: UserSeed,
  repos: RepoSeed[]
): void {
  db.run("INSERT INTO users (id, username) VALUES (?, ?)", [user.id, user.username]);

  let commitSeq = 0;
  for (const r of repos) {
    db.run(
      "INSERT INTO repos (id, name, language, stars, forks, last_commit_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [r.id, r.name, r.language, r.stars, r.forks, r.lastCommitDate, null]
    );
    for (const row of r.monthlyCommits) {
      if (!row.month || row.commits <= 0) continue;
      const day = `${row.month}-15`;
      const count = Math.max(0, Math.floor(row.commits));
      const cid = `c_${commitSeq++}`;
      db.run(
        "INSERT INTO commits (id, repo_id, date, additions, deletions) VALUES (?, ?, ?, ?, ?)",
        [cid, r.id, day, count, 0]
      );
    }
  }
}

/** Populate language_shares from GitHub-derived percentages (one row per language). */
export function seedLanguageShares(
  db: SqliteDatabase,
  rows: { language: string; percentage: number }[]
): void {
  for (const row of rows) {
    const lang = row.language?.trim();
    if (!lang) continue;
    const pct = Math.max(0, Math.min(100, Math.round(row.percentage)));
    if (pct <= 0) continue;
    db.run("INSERT OR REPLACE INTO language_shares (language, percentage) VALUES (?, ?)", [lang, pct]);
  }
}

/** When language_shares is empty, approximate shares by counting repos' primary language (repos.language). */
export const FALLBACK_GITHUB_REPO_COUNT_SQL = `SELECT 'GitHub repositories' AS name, value AS value FROM account_stats WHERE key = 'github_repo_count'`;

/** Repos created per calendar month (GitHub API rows gh_* or portfolio fallback pf_*). */
export const FALLBACK_REPOS_CREATED_BY_MONTH_SQL = `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count FROM repos WHERE (id LIKE 'gh_%' OR id LIKE 'pf_%') AND created_at IS NOT NULL AND TRIM(created_at) != '' GROUP BY strftime('%Y-%m', created_at) ORDER BY month LIMIT 120`;

export function hasGithubRepoCountInDb(db: SqliteDatabase): boolean {
  try {
    const r = db.exec("SELECT 1 FROM account_stats WHERE key = 'github_repo_count' LIMIT 1");
    return (r[0]?.values?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export function seedAccountStats(db: SqliteDatabase, entries: Record<string, number>): void {
  for (const [key, value] of Object.entries(entries)) {
    const k = key?.trim();
    if (!k) continue;
    const v = Math.max(0, Math.round(Number(value)));
    db.run("INSERT OR REPLACE INTO account_stats (key, value) VALUES (?, ?)", [k, v]);
  }
}

function isoDateOnly(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  const d = iso.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const t = Date.parse(iso);
  if (!Number.isNaN(t)) {
    const x = new Date(t).toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  }
  return null;
}

/** One row per GitHub repo (id gh_<numericId>) so COUNT and listings match the API when account_stats is present. */
export function seedGithubReposForAgent(
  db: SqliteDatabase,
  repos: Array<{
    id: number;
    fullName: string;
    name: string;
    language: string | null;
    stargazersCount: number;
    createdAt: string;
  }>,
  maxRows = 2000
): void {
  for (const r of repos.slice(0, maxRows)) {
    const id = `gh_${r.id}`;
    const shortName = r.fullName.includes("/") ? (r.fullName.split("/").pop() ?? r.name) : r.name;
    const created = isoDateOnly(r.createdAt);
    db.run(
      "INSERT OR REPLACE INTO repos (id, name, language, stars, forks, last_commit_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, shortName, r.language ?? "", Math.max(0, Math.round(r.stargazersCount ?? 0)), 0, null, created]
    );
  }
}

/** When the GitHub repo list API fails, still allow time-series from portfolio repo rows (created_at = added-to-portfolio). */
export function seedPortfolioReposForAgent(
  db: SqliteDatabase,
  rows: Array<{ id: string; repoFullName: string; createdAt: Date | string }>
): void {
  for (const r of rows) {
    const id = `pf_${r.id}`;
    const shortName = r.repoFullName.includes("/")
      ? (r.repoFullName.split("/").pop() ?? r.repoFullName)
      : r.repoFullName;
    const created =
      r.createdAt instanceof Date
        ? r.createdAt.toISOString().slice(0, 10)
        : isoDateOnly(String(r.createdAt)) ?? "";
    db.run(
      "INSERT OR REPLACE INTO repos (id, name, language, stars, forks, last_commit_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, shortName, "", 0, 0, null, created || null]
    );
  }
}

export function hasRepoCreatedTimeSeriesInDb(db: SqliteDatabase): boolean {
  try {
    const r = db.exec(
      "SELECT COUNT(*) AS n FROM repos WHERE (id LIKE 'gh_%' OR id LIKE 'pf_%') AND created_at IS NOT NULL AND TRIM(created_at) != ''"
    );
    const v = r[0]?.values?.[0]?.[0];
    return Number(typeof v === "number" ? v : Number(v)) > 0;
  } catch {
    return false;
  }
}

export function seedLanguageSharesFromRepoLanguagesColumn(db: SqliteDatabase): void {
  try {
    const res = db.exec(
      "SELECT language FROM repos WHERE language IS NOT NULL AND TRIM(language) != '' AND LOWER(language) NOT IN ('mixed', 'unknown')"
    );
    const vals = res[0]?.values ?? [];
    const counts: Record<string, number> = {};
    for (const row of vals) {
      const lang = String(row[0] ?? "").trim();
      if (!lang) continue;
      counts[lang] = (counts[lang] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total <= 0) return;
    const rows = Object.entries(counts).map(([language, c]) => ({
      language,
      percentage: Math.round((c / total) * 100),
    }));
    seedLanguageShares(db, rows.sort((a, b) => b.percentage - a.percentage));
  } catch {
    // ignore
  }
}

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|BEGIN|COMMIT|ROLLBACK|TRUNCATE|COPY|IMPORT)\b/i;

/** Strip markdown fences and trim. */
export function normalizeGeneratedSql(raw: string): string {
  const m = raw.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  const body = (m ? m[1] : raw).trim();
  return body.replace(/;+\s*$/g, "").trim();
}

/**
 * Read-only SELECT validation for SQLite.
 */
export function validateReadOnlySelect(sql: string): { ok: true } | { ok: false; error: string } {
  const q = normalizeGeneratedSql(sql);
  if (!q) return { ok: false, error: "Empty SQL." };
  if (FORBIDDEN.test(q)) return { ok: false, error: "Only read-only SELECT queries are allowed." };
  const upper = q.replace(/^\s+/u, "").toUpperCase();
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { ok: false, error: "Query must be a SELECT (or WITH … SELECT)." };
  }
  const parts = q.split(";").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return { ok: false, error: "Only one SQL statement is allowed." };
  return { ok: true };
}

/** Run validated SELECT; returns row objects. */
export function executeSQL(db: SqliteDatabase, sql: string): Record<string, unknown>[] {
  const v = validateReadOnlySelect(sql);
  if (!v.ok) throw new Error(v.error);
  const q = normalizeGeneratedSql(sql);
  const res = db.exec(q);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((row) => {
    const o: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      o[col] = row[i];
    });
    return o;
  });
}

export function closeDatabase(db: SqliteDatabase): void {
  try {
    db.close();
  } catch {
    // ignore
  }
}

/** Fixed SELECTs for introspection (no user input). */
export function countCommitsRows(db: SqliteDatabase): number {
  try {
    const res = db.exec("SELECT COUNT(*) AS n FROM commits");
    const v = res[0]?.values?.[0]?.[0];
    return typeof v === "number" ? v : Number(v) || 0;
  } catch {
    return 0;
  }
}

export function countLanguageShareRows(db: SqliteDatabase): number {
  try {
    const res = db.exec("SELECT COUNT(*) AS n FROM language_shares");
    const v = res[0]?.values?.[0]?.[0];
    return typeof v === "number" ? v : Number(v) || 0;
  } catch {
    return 0;
  }
}

/**
 * Human-readable facts for the SQL LLM so filters match real repo ids and date bounds.
 */
export function getAgentDatasetSummary(db: SqliteDatabase): string {
  const lines: string[] = [];
  try {
    const n = countCommitsRows(db);
    lines.push(`commits rows: ${n}`);
    if (n > 0) {
      const r = db.exec("SELECT MIN(date), MAX(date) FROM commits");
      const row = r[0]?.values?.[0];
      if (row && row[0] != null && row[1] != null) {
        lines.push(`commits.date (ISO) min: ${row[0]}, max: ${row[1]}`);
      }
    }
    const repos = db.exec("SELECT id, name, language FROM repos ORDER BY name");
    const cols = repos[0]?.columns ?? [];
    const vals = repos[0]?.values ?? [];
    const idIdx = cols.indexOf("id");
    const nameIdx = cols.indexOf("name");
    const langIdx = cols.indexOf("language");
    if (vals.length) {
      lines.push(
        "repos (use these id / name values exactly): " +
          vals
            .map((v) => {
              const id = v[idIdx];
              const name = v[nameIdx];
              const lang = langIdx >= 0 ? v[langIdx] : "";
              return `${String(id)}="${String(name)}" lang=${String(lang)}`;
            })
            .join("; ")
      );
    }

    const ghPf = db.exec(
      "SELECT COUNT(*) AS n, MIN(created_at) AS ca_min, MAX(created_at) AS ca_max FROM repos WHERE (id LIKE 'gh_%' OR id LIKE 'pf_%') AND created_at IS NOT NULL AND TRIM(created_at) != ''"
    );
    const gcols = ghPf[0]?.columns ?? [];
    const grow = ghPf[0]?.values?.[0];
    const gcn = gcols.indexOf("n");
    const gcmin = gcols.indexOf("ca_min");
    const gcmax = gcols.indexOf("ca_max");
    if (grow && gcn >= 0 && Number(grow[gcn]) > 0) {
      lines.push(
        `repos with created_at (GitHub gh_* or portfolio pf_*): count=${String(grow[gcn])}, min=${String(grow[gcmin])}, max=${String(grow[gcmax])} — for repos opened/created over time, GROUP BY strftime('%Y-%m', created_at)`
      );
    }

    const users = db.exec("SELECT id, username FROM users");
    const uc = users[0]?.columns ?? [];
    const uv = users[0]?.values?.[0];
    if (uv) {
      const ui = uc.indexOf("id");
      const uu = uc.indexOf("username");
      lines.push(`users: id=${String(uv[ui])} username=${String(uv[uu])}`);
    }

    const ln = countLanguageShareRows(db);
    lines.push(`language_shares rows: ${ln}`);
    if (ln > 0) {
      const ls = db.exec("SELECT language, percentage FROM language_shares ORDER BY percentage DESC LIMIT 12");
      const lc = ls[0]?.columns ?? [];
      const lv = ls[0]?.values ?? [];
      const li = lc.indexOf("language");
      const lp = lc.indexOf("percentage");
      lines.push(
        "language_shares (for pie charts of languages): " +
          lv.map((row) => `${String(row[li])}=${String(row[lp])}%`).join(", ")
      );
    }

    const stats = db.exec("SELECT key, value FROM account_stats");
    const sc = stats[0]?.columns ?? [];
    const sv = stats[0]?.values ?? [];
    const ski = sc.indexOf("key");
    const svi = sc.indexOf("value");
    if (sv.length && ski >= 0 && svi >= 0) {
      lines.push(
        "account_stats: " +
          sv.map((row) => `${String(row[ski])}=${String(row[svi])}`).join("; ") +
          " — for total GitHub repo count use SELECT value FROM account_stats WHERE key = 'github_repo_count'"
      );
    }
  } catch {
    lines.push("(could not read dataset summary)");
  }
  return lines.join("\n");
}

/** Broad monthly rollup — always returns rows when commits exist. */
export const FALLBACK_MONTHLY_ACTIVITY_SQL = `SELECT strftime('%Y-%m', date) AS month, SUM(additions) AS activity FROM commits GROUP BY strftime('%Y-%m', date) ORDER BY month LIMIT 60`;

/** Language distribution — use when the question is about languages or pies and commits query returned nothing. */
export const FALLBACK_LANGUAGE_SHARES_SQL = `SELECT language, percentage FROM language_shares ORDER BY percentage DESC`;
