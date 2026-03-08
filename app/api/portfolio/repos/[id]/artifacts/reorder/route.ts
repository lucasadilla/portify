import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/portfolio/repos/[id]/artifacts/reorder
 * Body: { orderedIds: string[] } - artifact ids in the desired display order.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: repoId } = await params;
  const repo = await prisma.portfolioRepo.findFirst({
    where: { id: repoId },
    include: { portfolio: true, artifacts: true },
  });
  if (!repo || repo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { orderedIds } = body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
  }

  const repoArtifactIds = new Set(repo.artifacts.map((a) => a.id));
  const validIds = orderedIds.filter((id) => repoArtifactIds.has(id));
  if (validIds.length !== orderedIds.length) {
    return NextResponse.json({ error: "All ids must belong to this repo" }, { status: 400 });
  }

  await Promise.all(
    validIds.map((artifactId, index) =>
      prisma.repoArtifact.update({
        where: { id: artifactId },
        data: { sortOrder: index },
      })
    )
  );
  return NextResponse.json({ ok: true });
}
