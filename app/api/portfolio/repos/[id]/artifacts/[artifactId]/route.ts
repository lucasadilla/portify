import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: repoId, artifactId } = await params;
  const artifact = await prisma.repoArtifact.findFirst({
    where: { id: artifactId, portfolioRepoId: repoId },
    include: { portfolioRepo: { include: { portfolio: true } } },
  });
  if (!artifact || artifact.portfolioRepo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { metadata } = body as { metadata?: string | Record<string, unknown> };
  if (metadata === undefined) {
    return NextResponse.json({ error: "metadata required" }, { status: 400 });
  }
  const metadataStr = typeof metadata === "string" ? metadata : JSON.stringify(metadata);

  const updated = await prisma.repoArtifact.update({
    where: { id: artifactId },
    data: { metadata: metadataStr },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: repoId, artifactId } = await params;
  const artifact = await prisma.repoArtifact.findFirst({
    where: { id: artifactId, portfolioRepoId: repoId },
    include: { portfolioRepo: { include: { portfolio: true } } },
  });
  if (!artifact || artifact.portfolioRepo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.repoArtifact.delete({ where: { id: artifactId } });
  return NextResponse.json({ ok: true });
}
