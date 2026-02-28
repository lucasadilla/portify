import { createGenerateWorker, type GenerateJobData } from "../lib/jobQueue";
import { setRepoStatus, upsertJob } from "./lib/db";
import { detectStack } from "../lib/stackDetector";
import { cloneRepo, listFiles, parsePackageJson } from "./jobs/analyze";
import { runSummary } from "./jobs/summary";
import { runBuild } from "./jobs/build";
import { runScreenshot } from "./jobs/screenshot";
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
    await runBuild(portfolioRepoId, repoDir, runPlan);
    await runScreenshot(portfolioRepoId, repoDir, runPlan);
    await runDiagram(portfolioRepoId, repoDir);

    await setRepoStatus(portfolioRepoId, "DONE");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertJob(portfolioRepoId, "analyze", "FAILED", 0, message).catch(() => {});
    await setRepoStatus(portfolioRepoId, "FAILED");
  }
}

const worker = createGenerateWorker(async (job) => {
  await processJob(job.data);
});

worker.run();
console.log("Portify worker running. Waiting for jobs...");
