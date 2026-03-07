import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/portfolio/repos/reorder
 * Body: { orderedIds: string[] } - repo ids in the desired display order.
 * Updates pinnedOrder so the list displays in this order (first 4 are "pinned" top projects).
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderedIds } = body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: { repos: { select: { id: true } } },
  });
  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });

  const portfolioRepoIds = new Set(portfolio.repos.map((r) => r.id));
  const validIds = orderedIds.filter((id) => portfolioRepoIds.has(id));
  if (validIds.length !== orderedIds.length) {
    return NextResponse.json({ error: "Some repo ids are not in your portfolio" }, { status: 400 });
  }

  await prisma.$transaction(
    validIds.map((id, index) =>
      prisma.portfolioRepo.update({
        where: { id },
        data: { pinnedOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
