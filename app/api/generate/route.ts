import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessToken } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addGenerateJob } from "@/lib/jobQueue";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { portfolioRepoId } = body as { portfolioRepoId: string };
  if (!portfolioRepoId) return NextResponse.json({ error: "portfolioRepoId required" }, { status: 400 });

  const repo = await prisma.portfolioRepo.findFirst({
    where: { id: portfolioRepoId },
    include: { portfolio: true },
  });
  if (!repo || repo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "GitHub token missing" }, { status: 400 });

  await prisma.portfolioRepo.update({
    where: { id: portfolioRepoId },
    data: { status: "QUEUED" },
  });
  await prisma.repoArtifact.deleteMany({ where: { portfolioRepoId } });
  await prisma.job.deleteMany({ where: { portfolioRepoId } });

  try {
    const job = await addGenerateJob({
      portfolioRepoId: repo.id,
      portfolioId: repo.portfolioId,
      repoFullName: repo.repoFullName,
      branch: repo.branch,
      accessToken: token,
    });
    return NextResponse.json({ jobId: job.id, portfolioRepoId });
  } catch (e) {
    await prisma.portfolioRepo.update({
      where: { id: portfolioRepoId },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }
}
