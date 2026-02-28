import { prisma } from "../../lib/db";
import type { JobType, JobStatus } from "@prisma/client";

export async function upsertJob(
  portfolioRepoId: string,
  type: JobType,
  status: JobStatus,
  progress: number,
  error?: string | null
) {
  const existing = await prisma.job.findFirst({
    where: { portfolioRepoId, type },
  });
  if (existing) {
    return prisma.job.update({
      where: { id: existing.id },
      data: { status, progress, error: error ?? undefined },
    });
  }
  return prisma.job.create({
    data: { portfolioRepoId, type, status, progress, error: error ?? undefined },
  });
}

export async function setRepoStatus(
  portfolioRepoId: string,
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED",
  updates?: { customSummary?: string; detectedStackJson?: string; runnable?: boolean }
) {
  return prisma.portfolioRepo.update({
    where: { id: portfolioRepoId },
    data: { status, ...updates },
  });
}
