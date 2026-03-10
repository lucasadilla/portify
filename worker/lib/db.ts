import { prisma } from "../../lib/db";
import type { JobType, JobStatus } from "@prisma/client";

/** Call on worker startup: mark any repo left PROCESSING by a previous run/crash as FAILED so the UI can retry. */
export async function resetStaleProcessingRepos(): Promise<number> {
  const result = await prisma.portfolioRepo.updateMany({
    where: { status: "PROCESSING" },
    data: { status: "FAILED" },
  });
  return result.count;
}

function isPrismaP2025(e: unknown): boolean {
  return !!e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025";
}

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
    try {
      return await prisma.job.update({
        where: { id: existing.id },
        data: { status, progress, error: error ?? undefined },
      });
    } catch (e) {
      if (isPrismaP2025(e)) return null as unknown as Awaited<ReturnType<typeof prisma.job.update>>;
      throw e;
    }
  }
  try {
    return await prisma.job.create({
      data: { portfolioRepoId, type, status, progress, error: error ?? undefined },
    });
  } catch (e) {
    if (isPrismaP2025(e)) return null as unknown as Awaited<ReturnType<typeof prisma.job.create>>;
    throw e;
  }
}

export async function setRepoStatus(
  portfolioRepoId: string,
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED",
  updates?: { customSummary?: string; detectedStackJson?: string; runnable?: boolean }
) {
  try {
    return await prisma.portfolioRepo.update({
      where: { id: portfolioRepoId },
      data: { status, ...updates },
    });
  } catch (e: unknown) {
    if (isPrismaP2025(e)) return null as unknown as Awaited<ReturnType<typeof prisma.portfolioRepo.update>>;
    throw e;
  }
}
