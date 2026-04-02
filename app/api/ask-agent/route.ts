import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runSqlAgentPipeline } from "@/lib/agent";
import { generateInsights } from "@/lib/insights";
import { generateMermaid } from "@/lib/mermaid";
import { generateChartTitle } from "@/lib/agentTitle";
import { inferRechartsFromRows } from "@/lib/agentVisualization";
import {
  createEmptyAgentDatabase,
  seedAgentDatabase,
  closeDatabase,
  countCommitsRows,
  countLanguageShareRows,
  seedLanguageShares,
  seedLanguageSharesFromRepoLanguagesColumn,
  seedAccountStats,
  seedGithubReposForAgent,
  seedPortfolioReposForAgent,
} from "@/lib/sql";
import {
  buildProfileDataset,
  portfolioRepoToSeed,
  liveRepoActivityToSeed,
} from "@/lib/visual-agent-dataset";
import { sessionCanEditPortfolio } from "@/lib/portfolioAccess";
import { resolveWorkingGitHubToken } from "@/lib/session";
import {
  getContributionHistoryFromGraphQL,
  getContributionHistoryByAuthor,
  getGitHubUserProfile,
  getRepoCommitHistory,
  getRepoLanguages,
  getAccountLanguagePercentages,
  fetchGitHubReposForVisualAgent,
  languageBytesToPercentages,
} from "@/lib/github";

/** Cap parallel repo fetches so one question stays within route timeout. */
const MAX_LIVE_REPOS_PER_ASK = 18;

export const runtime = "nodejs";
export const maxDuration = 120;

/** Avoids 404 on GET (devtools/prefetch); documents POST-only API. */
export function GET() {
  return NextResponse.json({
    ok: true,
    name: "Portify Visual SQL Agent",
    methods: ["POST"],
    postBody: {
      question: "string (3–600 chars)",
      scope: "'repo' | 'profile'",
      portfolioRepoId: "when scope is repo",
      portfolioSlug: "when scope is profile",
    },
    response: {
      dataSource: "github_live | github_cached",
      githubRepoSource:
        "github_list | github_first_page | github_per_repo | portfolio_only — where repo rows for charts came from",
      title: "short display title (not the full prompt)",
      recharts: "pie | line | bar payload or null — when set, use Recharts like other portfolio charts",
      mermaid: "diagram source when recharts is null",
    },
  });
}

type Body = {
  question?: string;
  scope?: "repo" | "profile";
  portfolioRepoId?: string;
  portfolioSlug?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 3 || question.length > 600) {
    return NextResponse.json({ error: "Question must be between 3 and 600 characters." }, { status: 400 });
  }

  const scope = body.scope === "repo" ? "repo" : body.scope === "profile" ? "profile" : null;
  if (!scope) {
    return NextResponse.json({ error: "scope must be 'repo' or 'profile'" }, { status: 400 });
  }

  const db = await createEmptyAgentDatabase();
  let dataSource: "github_live" | "github_cached" = "github_cached";
  let githubRepoSource: "github_list" | "github_first_page" | "github_per_repo" | "portfolio_only" | null = null;

  try {
    if (scope === "repo") {
      if (!body.portfolioRepoId) {
        return NextResponse.json({ error: "portfolioRepoId is required for repo scope" }, { status: 400 });
      }
      const repo = await prisma.portfolioRepo.findFirst({
        where: { id: body.portfolioRepoId },
        include: { portfolio: { include: { user: true } } },
      });
      if (!repo) {
        return NextResponse.json({ error: "Repository not found." }, { status: 404 });
      }
      if (!sessionCanEditPortfolio(session, repo.portfolio)) {
        return NextResponse.json(
          { error: "You don’t have permission to run the agent for this project. Sign in as the portfolio owner." },
          { status: 403 }
        );
      }
      const user = {
        id: "u1",
        username: repo.portfolio.user.username?.trim() || "developer",
      };
      const accessToken = await resolveWorkingGitHubToken(req, session.user.id);
      const [owner, repoShort] = repo.repoFullName.split("/");
      let repoLangBytes: Record<string, number> | null = null;
      if (accessToken && owner && repoShort) {
        try {
          const [activity, langs] = await Promise.all([
            getRepoCommitHistory(accessToken, owner, repoShort),
            getRepoLanguages(accessToken, owner, repoShort),
          ]);
          repoLangBytes = langs;
          const seed = liveRepoActivityToSeed(repo, activity, langs);
          seedAgentDatabase(db, user, [seed]);
          dataSource = "github_live";
        } catch {
          seedAgentDatabase(db, user, [portfolioRepoToSeed(repo)]);
        }
      } else {
        seedAgentDatabase(db, user, [portfolioRepoToSeed(repo)]);
      }
      if (repoLangBytes && Object.keys(repoLangBytes).length > 0) {
        seedLanguageShares(db, languageBytesToPercentages(repoLangBytes));
      } else if (accessToken && owner && repoShort) {
        try {
          const langs = await getRepoLanguages(accessToken, owner, repoShort);
          seedLanguageShares(db, languageBytesToPercentages(langs));
        } catch {
          // ignore
        }
      }
      if (countLanguageShareRows(db) === 0 && repo.languageBreakdownJson) {
        try {
          const arr = JSON.parse(repo.languageBreakdownJson) as { name: string; value: number }[];
          if (Array.isArray(arr) && arr.length) {
            seedLanguageShares(db, arr.map((r) => ({ language: r.name, percentage: r.value })));
          }
        } catch {
          // ignore
        }
      }
      if (countLanguageShareRows(db) === 0) {
        seedLanguageSharesFromRepoLanguagesColumn(db);
      }
    } else {
      const slug = typeof body.portfolioSlug === "string" ? body.portfolioSlug.toLowerCase().trim() : "";
      if (!slug) {
        return NextResponse.json({ error: "portfolioSlug is required for profile scope" }, { status: 400 });
      }
      const portfolio = await prisma.portfolio.findUnique({
        where: { slug },
        include: {
          user: true,
          repos: {
            where: { status: "DONE" },
            orderBy: { pinnedOrder: "asc" },
          },
        },
      });
      if (!portfolio) {
        return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
      }
      if (!sessionCanEditPortfolio(session, portfolio)) {
        return NextResponse.json(
          { error: "You don’t have permission to run the agent for this portfolio. Sign in as the owner." },
          { status: 403 }
        );
      }

      const username =
        portfolio.user.username?.trim() ||
        session.user.username?.trim() ||
        session.user.name?.trim() ||
        "developer";
      const accessToken = await resolveWorkingGitHubToken(req, session.user.id);

      type Monthly = { month: string; commits: number };
      let monthlyLive: Monthly[] | null = null;
      let profileSeeded = false;
      let loginForApi = username;

      if (accessToken) {
        try {
          const gh = await getGitHubUserProfile(accessToken);
          if (gh.login?.trim()) loginForApi = gh.login.trim();
        } catch {
          // use portfolio username
        }

        try {
          const fromGraph = await getContributionHistoryFromGraphQL(accessToken, loginForApi);
          if (Array.isArray(fromGraph) && fromGraph.length > 0) {
            monthlyLive = fromGraph.map((c) => ({ month: c.month, commits: c.count }));
          }
        } catch {
          // try author search
        }

        if (!monthlyLive?.length) {
          try {
            const sinceYear = Math.max(2008, new Date().getFullYear() - 10);
            const fromAuthor = await getContributionHistoryByAuthor(accessToken, loginForApi, sinceYear);
            if (Array.isArray(fromAuthor) && fromAuthor.length > 0) {
              monthlyLive = fromAuthor.map((c) => ({ month: c.month, commits: c.count }));
            }
          } catch {
            // try per-repo live
          }
        }

        const user = { id: "u1", username: loginForApi };

        if (monthlyLive?.length) {
          const last = monthlyLive[monthlyLive.length - 1];
          seedAgentDatabase(db, user, [
            {
              id: "account",
              name: "GitHub profile (contributions)",
              language: "",
              stars: 0,
              forks: 0,
              lastCommitDate: last ? `${last.month}-01` : null,
              monthlyCommits: monthlyLive,
            },
          ]);
          profileSeeded = true;
          dataSource = "github_live";
        } else if (portfolio.repos.length > 0) {
          const slice = portfolio.repos.slice(0, MAX_LIVE_REPOS_PER_ASK);
          const seeds = await Promise.all(
            slice.map(async (r) => {
              const [o, n] = r.repoFullName.split("/");
              if (!o || !n) return null;
              try {
                const [activity, langs] = await Promise.all([
                  getRepoCommitHistory(accessToken, o, n),
                  getRepoLanguages(accessToken, o, n),
                ]);
                return liveRepoActivityToSeed(r, activity, langs);
              } catch {
                return null;
              }
            })
          );
          const good = seeds.filter((s): s is NonNullable<typeof s> => s != null);
          if (good.length > 0) {
            seedAgentDatabase(db, user, good);
            profileSeeded = true;
            dataSource = "github_live";
          }
        }
      }

      if (!profileSeeded) {
        let monthly: Monthly[] | null = null;
        const cached = (portfolio as { contributionsJson?: string | null }).contributionsJson;
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Monthly[];
            if (Array.isArray(parsed) && parsed.length > 0) monthly = parsed;
          } catch {
            // ignore
          }
        }

        if (monthly?.length) {
          const user = { id: "u1", username };
          const last = monthly[monthly.length - 1];
          seedAgentDatabase(db, user, [
            {
              id: "account",
              name: "GitHub account",
              language: "",
              stars: 0,
              forks: 0,
              lastCommitDate: last ? `${last.month}-01` : null,
              monthlyCommits: monthly,
            },
          ]);
          profileSeeded = true;
          dataSource = "github_cached";
        } else if (portfolio.repos.length > 0) {
          const { user, repoSeeds } = buildProfileDataset(portfolio.user.username, portfolio.repos);
          seedAgentDatabase(db, user, repoSeeds);
          profileSeeded = true;
          dataSource = "github_cached";
        } else {
          return NextResponse.json(
            {
              error:
                "No GitHub data to analyze. Sign in with GitHub (OAuth token), open this page while logged in, or add processed repos to your portfolio.",
            },
            { status: 400 }
          );
        }
      }

      if (accessToken) {
        try {
          const shares = await getAccountLanguagePercentages(accessToken);
          if (shares.length) seedLanguageShares(db, shares);
        } catch {
          // ignore
        }
      }
      const langsJson = (portfolio as { languagesJson?: string | null }).languagesJson;
      if (countLanguageShareRows(db) === 0 && langsJson) {
        try {
          const parsed = JSON.parse(langsJson) as { name: string; value: number }[];
          if (Array.isArray(parsed) && parsed.length) {
            seedLanguageShares(db, parsed.map((r) => ({ language: r.name, percentage: r.value })));
          }
        } catch {
          // ignore
        }
      }

      const portfolioRepoNamesForGithub = await prisma.portfolioRepo.findMany({
        where: { portfolioId: portfolio.id },
        select: { repoFullName: true },
      });

      if (accessToken) {
        const { repos: ghRepos, source } = await fetchGitHubReposForVisualAgent(
          accessToken,
          portfolioRepoNamesForGithub
        );
        if (ghRepos.length > 0) {
          seedAccountStats(db, { github_repo_count: ghRepos.length });
          seedGithubReposForAgent(db, ghRepos);
          githubRepoSource =
            source === "github_list"
              ? "github_list"
              : source === "github_first_page"
                ? "github_first_page"
                : "github_per_repo";
        } else if (portfolio.repos.length > 0) {
          seedAccountStats(db, { github_repo_count: portfolio.repos.length });
          seedPortfolioReposForAgent(db, portfolio.repos);
          githubRepoSource = "portfolio_only";
        }
      } else if (portfolio.repos.length > 0) {
        seedAccountStats(db, { github_repo_count: portfolio.repos.length });
        seedPortfolioReposForAgent(db, portfolio.repos);
        githubRepoSource = "portfolio_only";
      }

      if (countLanguageShareRows(db) === 0) {
        seedLanguageSharesFromRepoLanguagesColumn(db);
      }
    }

    const commitsLoaded = countCommitsRows(db);
    const pipeline = await runSqlAgentPipeline({ question, database: db });
    if (!pipeline.ok) {
      return NextResponse.json(
        { ok: false, error: pipeline.error, sql: pipeline.sql },
        { status: 422 }
      );
    }

    const resultPayload = pipeline.rows;
    const recharts = inferRechartsFromRows(resultPayload);
    const title = await generateChartTitle(question);

    const [insights, mermaid] = await Promise.all([
      generateInsights(resultPayload, question, { commitsInDataset: commitsLoaded }),
      recharts ? Promise.resolve("") : generateMermaid(resultPayload, question),
    ]);

    return NextResponse.json({
      ok: true,
      question,
      title,
      sql: pipeline.sql,
      rows: resultPayload,
      rowCount: pipeline.rowCount,
      insights,
      recharts,
      mermaid: recharts ? "" : mermaid,
      dataSource,
      githubRepoSource,
    });
  } finally {
    closeDatabase(db);
  }
}
