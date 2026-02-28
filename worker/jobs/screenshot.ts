import { setRepoStatus, upsertJob } from "../lib/db";
import { prisma } from "../../lib/db";
import { uploadBuffer } from "../../lib/s3";
import type { RunPlan } from "../../lib/stackDetector";

export async function runScreenshot(
  portfolioRepoId: string,
  _repoDir: string,
  _runPlan: RunPlan
): Promise<void> {
  await upsertJob(portfolioRepoId, "screenshot", "ACTIVE", 0, null);
  try {
    const placeholder = Buffer.from(
      "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect fill='%231e293b' width='800' height='600'/><text x='50%' y='50%' fill='%2394a3b8' text-anchor='middle' dy='.3em'>Screenshot placeholder</text></svg>",
      "utf-8"
    );
    const url = await uploadBuffer(
      `screenshots/${portfolioRepoId}/desktop.svg`,
      placeholder,
      "image/svg+xml"
    );
    await prisma.repoArtifact.create({
      data: { portfolioRepoId, type: "screenshot", url },
    });
  } catch {
    // S3 not configured; skip artifact
  }
  await upsertJob(portfolioRepoId, "screenshot", "COMPLETED", 100, null);
}
