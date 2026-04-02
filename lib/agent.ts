/**
 * Natural language → SQL (OpenAI) for the Visual SQL Agent.
 */

import OpenAI from "openai";
import {
  VISUAL_AGENT_SCHEMA_FOR_LLM,
  normalizeGeneratedSql,
  validateReadOnlySelect,
  executeSQL,
  getAgentDatasetSummary,
  countCommitsRows,
  countLanguageShareRows,
  FALLBACK_MONTHLY_ACTIVITY_SQL,
  FALLBACK_LANGUAGE_SHARES_SQL,
  FALLBACK_GITHUB_REPO_COUNT_SQL,
  FALLBACK_REPOS_CREATED_BY_MONTH_SQL,
  hasGithubRepoCountInDb,
  hasRepoCreatedTimeSeriesInDb,
  type SqliteDatabase,
} from "@/lib/sql";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function generateSQL(
  question: string,
  schema: string = VISUAL_AGENT_SCHEMA_FOR_LLM,
  datasetSummary?: string
): Promise<string> {
  if (!openai) {
    return `SELECT language, percentage FROM language_shares ORDER BY percentage DESC LIMIT 20`;
  }
  const summaryBlock =
    datasetSummary && datasetSummary.trim().length > 0
      ? `\nDataset snapshot (must match these ids and dates; do not guess repo names):\n${datasetSummary}\n`
      : "";
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a SQLite analyst. Output ONLY a single valid SQLite SELECT query (or WITH … SELECT). No markdown, no explanation, no semicolons at the end.
Rules:
- Use ONLY these tables/columns:
${schema}
- For questions about total contributions, commits, or activity over months or date ranges: use SUM(additions) with date filters on commits.date. Do NOT use COUNT(*) for that — each row is one month bucket, and COUNT(*) would count months, not activity.
- Prefer aggregations (SUM, AVG) when comparing repos or activity over time.
- Filter dates using commits.date as TEXT (YYYY-MM-DD). Only use ranges that fall within min/max in the dataset snapshot when present.
- If the question names a month range, use: date >= 'YYYY-MM-01' AND date < 'YYYY-MM-01' for the month after the last month, OR use strftime('%Y-%m', date) IN (...).
- Dates are TEXT in ISO form (YYYY-MM-DD).
- Limit large results: add LIMIT 50 when listing rows.
- For pie charts or questions about which programming languages the user uses: query language_shares (e.g. SELECT language, percentage FROM language_shares ORDER BY percentage DESC). Use the percentage column as slice weights.
- For how many GitHub repositories the user has (single total, not a time series): use account_stats (e.g. SELECT value FROM account_stats WHERE key = 'github_repo_count') or COUNT repos WHERE id LIKE 'gh_%' OR id LIKE 'pf_%'. Do not use COUNT(*) on repos without filtering out id 'account' when the question is only about total repo count.
- For repositories created or opened over time (by month/year): use repos.created_at on rows where id LIKE 'gh_%' OR id LIKE 'pf_%', GROUP BY month/year. Do not use account_stats for that.
- Never invent table or column names.`,
      },
      {
        role: "user",
        content: `${summaryBlock}Question: ${question.slice(0, 2000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 500,
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  return normalizeGeneratedSql(text);
}

export type AgentPipelineInput = {
  question: string;
  database: SqliteDatabase;
};

export type AgentPipelineResult =
  | {
      ok: true;
      sql: string;
      rows: Record<string, unknown>[];
      rowCount: number;
    }
  | { ok: false; error: string; sql?: string };

/**
 * generateSQL → validate → execute on in-memory DB.
 * If the model returns rows that match nothing, retry with stricter instructions, then a deterministic monthly rollup.
 */
export async function runSqlAgentPipeline(input: AgentPipelineInput): Promise<AgentPipelineResult> {
  const { question, database } = input;
  const summary = getAgentDatasetSummary(database);
  const committed = countCommitsRows(database);
  const langN = countLanguageShareRows(database);
  const languageIntent = /\b(language|languages|pie|stack|programming|codebase|typescript|javascript|python|java|rust|go\b)/i.test(
    question
  );
  const mentionsReposOverTime =
    /\b(over time|overtime|per month|per year|monthly|yearly|timeline|each month|each year|by month|by year|when i|when you|created|opened|since|history|cumulative)\b/i.test(
      question
    );

  const mentionsReposOrGithubProjects =
    /\b(repo|repos|repository|repositories|repositor|github|project|projects)\b/i.test(question);

  const repoCountIntent =
    !mentionsReposOverTime &&
    /\b(how many|number of|count|total)\b/i.test(question) &&
    mentionsReposOrGithubProjects;

  /** User wants repos/projects on GitHub laid out over time — not a single total. */
  const reposCreatedOverTimeQuestion =
    mentionsReposOrGithubProjects &&
    (mentionsReposOverTime ||
      (/\b(number of|how many)\b/i.test(question) &&
        /\b(over time|time|month|year|timeline|years?)\b/i.test(question)) ||
      (/\b(graph|chart|plot)\b/i.test(question) && /\b(over time|time|month|year|timeline|created|opened)\b/i.test(question)));

  try {
    let sql = await generateSQL(question, VISUAL_AGENT_SCHEMA_FOR_LLM, summary);
    let v = validateReadOnlySelect(sql);
    if (!v.ok) return { ok: false, error: v.error, sql };

    let rows = executeSQL(database, sql);

    if (rows.length === 0 && committed > 0) {
      const retryQ = `${question}\n\nThe previous SELECT returned zero rows but the dataset has ${committed} commit rows. Rewrite the query: join commits to repos only using repo ids from the snapshot; filter commits.date using only the min/max range shown; for monthly totals use SUM(additions) GROUP BY strftime('%Y-%m', date). If the question is about languages or a pie chart of languages, use language_shares instead (${langN} rows available). If the question is about total GitHub repo count only, use account_stats (github_repo_count) or COUNT FROM repos WHERE id LIKE 'gh_%' OR id LIKE 'pf_%'. If the question is about repos created or opened over time, use repos.created_at with id LIKE 'gh_%' OR id LIKE 'pf_%', GROUP BY strftime('%Y-%m', created_at).`;
      sql = await generateSQL(retryQ, VISUAL_AGENT_SCHEMA_FOR_LLM, summary);
      v = validateReadOnlySelect(sql);
      if (v.ok) {
        rows = executeSQL(database, sql);
      }
    }

    // LLM often returns account_stats (one row) for "repos over time" — override with real monthly series.
    if (reposCreatedOverTimeQuestion && hasRepoCreatedTimeSeriesInDb(database)) {
      const tsSql = FALLBACK_REPOS_CREATED_BY_MONTH_SQL;
      const tsRows = executeSQL(database, tsSql);
      if (tsRows.length > 0) {
        sql = tsSql;
        rows = tsRows;
      }
    }

    if (rows.length === 0 && repoCountIntent && hasGithubRepoCountInDb(database)) {
      sql = FALLBACK_GITHUB_REPO_COUNT_SQL;
      rows = executeSQL(database, sql);
    }

    if (rows.length === 0 && langN > 0 && (languageIntent || committed === 0)) {
      sql = FALLBACK_LANGUAGE_SHARES_SQL;
      rows = executeSQL(database, sql);
    }

    if (rows.length === 0 && committed > 0) {
      sql = FALLBACK_MONTHLY_ACTIVITY_SQL;
      rows = executeSQL(database, sql);
    }

    if (rows.length === 0 && langN > 0) {
      sql = FALLBACK_LANGUAGE_SHARES_SQL;
      rows = executeSQL(database, sql);
    }

    return { ok: true, sql, rows, rowCount: rows.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
