import { generateSummary } from "../../lib/openai";
import { setRepoStatus, upsertJob } from "../lib/db";
import type { RunPlan } from "../../lib/stackDetector";
import { analyzeRepo } from "./analyze";

export async function runSummary(
  portfolioRepoId: string,
  repoDir: string,
  runPlan: RunPlan
): Promise<{ summary: string; techStack: string[] }> {
  await upsertJob(portfolioRepoId, "summary", "ACTIVE", 10, null);
  const { readme, packageJson, languages, keyFolders } = await analyzeRepo(repoDir, runPlan);
  await upsertJob(portfolioRepoId, "summary", "ACTIVE", 50, null);
  const result = await generateSummary({ readme, packageJson, languages, keyFolders });
  await upsertJob(portfolioRepoId, "summary", "COMPLETED", 100, null);
  await setRepoStatus(portfolioRepoId, "PROCESSING", {
    customSummary: result.summary,
    detectedStackJson: JSON.stringify(result.techStack),
  });
  return result;
}
