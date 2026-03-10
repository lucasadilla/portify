import "dotenv/config";
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
import { createGenerateWorker, type GenerateJobData } from "../lib/jobQueue";
import { setRepoStatus, upsertJob, resetStaleProcessingRepos } from "./lib/db";
import { prisma } from "../lib/db";
import { detectStack } from "../lib/stackDetector";
import { cloneRepo, listFiles, parsePackageJson } from "./jobs/analyze";
import { runSummary } from "./jobs/summary";
import { runDiagram } from "./jobs/diagram";
import { refreshPortfolioGitHubData, refreshRepoGitHubData } from "./jobs/githubProfile";

async function processJob(data: GenerateJobData) {
  const { portfolioRepoId, repoFullName, branch, accessToken } = data;
  let repoDir: string | null = null;

  try {
    await setRepoStatus(portfolioRepoId, "PROCESSING");

    await upsertJob(portfolioRepoId, "analyze", "ACTIVE", 5, null);
    repoDir = cloneRepo(repoFullName, branch, accessToken);
    const files = listFiles(repoDir);
    const pkg = parsePackageJson(repoDir);
    const runPlan = detectStack(files, pkg ?? undefined);
    await upsertJob(portfolioRepoId, "analyze", "COMPLETED", 100, null);

    const repoRecord = await prisma.portfolioRepo.findUnique({
      where: { id: portfolioRepoId },
      include: { portfolio: true },
    });
    if (repoRecord?.portfolio) {
      await refreshPortfolioGitHubData(repoRecord.portfolio.id, repoRecord.portfolio.userId);
    }

    await runSummary(portfolioRepoId, repoDir, runPlan);
    await refreshRepoGitHubData(portfolioRepoId);
    await runDiagram(portfolioRepoId, repoDir);

    await setRepoStatus(portfolioRepoId, "DONE");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertJob(portfolioRepoId, "analyze", "FAILED", 0, message).catch(() => {});
    await setRepoStatus(portfolioRepoId, "FAILED");
  }
}

const worker = createGenerateWorker(async (job) => {
  console.log("[Portify worker] Starting job:", job.data.repoFullName);
  try {
    await processJob(job.data);
    console.log("[Portify worker] Done:", job.data.repoFullName);
  } catch (err) {
    console.error("[Portify worker] Failed:", job.data.repoFullName, err);
    throw err;
  }
});

worker.on("failed", async (job, err) => {
  console.error("[Portify worker] Job failed:", job?.data?.repoFullName, err?.message);
  if (job?.data?.portfolioRepoId) {
    await setRepoStatus(job.data.portfolioRepoId, "FAILED").catch(() => {});
  }
});

const redisUrl = process.env.REDIS_URL;
const redisHost = redisUrl ? new URL(redisUrl).hostname : "localhost";
console.log("[Portify worker] Redis:", redisHost, redisUrl ? "(Upstash/local)" : "(default localhost)");

async function start() {
  const dbUrl = process.env.DATABASE_URL;
  const dbHost = dbUrl ? new URL(dbUrl).hostname : "not set";
  console.log("[Portify worker] DB host:", dbHost, dbUrl ? "(must match Vercel DB)" : "⚠️ DATABASE_URL missing");

  const reset = await resetStaleProcessingRepos().catch((e) => {
    console.error("[Portify worker] Failed to reset stale PROCESSING repos:", e);
    return 0;
  });
  if (reset > 0) console.log("[Portify worker] Reset", reset, "stale PROCESSING repo(s) to FAILED (previous run was interrupted).");

  const repoCount = await prisma.portfolioRepo.count().catch(() => -1);
  if (repoCount >= 0) console.log("[Portify worker] DB OK, portfolio repos in DB:", repoCount);
  else console.error("[Portify worker] DB connection failed — check DATABASE_URL");

  console.log("Portify worker running. Waiting for jobs...");
}
start();
