import { setRepoStatus, upsertJob } from "../lib/db";
import type { RunPlan } from "../../lib/stackDetector";

export async function runBuild(
  portfolioRepoId: string,
  _repoDir: string,
  _runPlan: RunPlan
): Promise<{ runnable: boolean; port?: number }> {
  await upsertJob(portfolioRepoId, "build", "ACTIVE", 20, null);
  // MVP: Skip actual Docker/build in worker to avoid sandbox setup; mark as not runnable.
  // In production you would: clone in container, run install/build/start, health-check port.
  await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, null);
  await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
  return { runnable: false };
}
