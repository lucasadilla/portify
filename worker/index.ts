import "dotenv/config";
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
import { createGenerateWorker, type GenerateJobData } from "../lib/jobQueue";
import { setRepoStatus, upsertJob, resetStaleProcessingRepos } from "./lib/db";
import { detectStack } from "../lib/stackDetector";
import { cloneRepo, listFiles, parsePackageJson } from "./jobs/analyze";
import { runSummary } from "./jobs/summary";
import { runBuild, cleanupBuild } from "./jobs/build";
import { runDiagram } from "./jobs/diagram";

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

    await runSummary(portfolioRepoId, repoDir, runPlan);
    let buildResult: Awaited<ReturnType<typeof runBuild>>;
    try {
      buildResult = await runBuild(portfolioRepoId, repoDir, runPlan);
    } catch {
      buildResult = { runnable: false };
    }

    try {
      await runDiagram(portfolioRepoId, repoDir);
    } finally {
      await cleanupBuild(buildResult, runPlan, repoDir);
    }

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
  const reset = await resetStaleProcessingRepos().catch((e) => {
    console.error("[Portify worker] Failed to reset stale PROCESSING repos:", e);
    return 0;
  });
  if (reset > 0) console.log("[Portify worker] Reset", reset, "stale PROCESSING repo(s) to FAILED (previous run was interrupted).");
  console.log("Portify worker running. Waiting for jobs...");
}
start();
