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
  let result: { summary: string; techStack: string[] };
  let summaryError: string | null = null;
  try {
    result = await generateSummary({ readme, packageJson, languages, keyFolders });
  } catch (err) {
    summaryError = err instanceof Error ? err.message : String(err);
    result = {
      summary: `Summary unavailable (${summaryError.slice(0, 120)}). Set OPENAI_API_KEY in .env for AI summaries.`,
      techStack: languages.length ? languages : ["Unknown"],
    };
  }
  await upsertJob(portfolioRepoId, "summary", "COMPLETED", 100, summaryError);
  await setRepoStatus(portfolioRepoId, "PROCESSING", {
    customSummary: result.summary,
    detectedStackJson: JSON.stringify(result.techStack),
  });
  return result;
}
