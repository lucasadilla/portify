import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/account/delete
 * Permanently deletes the signed-in user's account and all associated data
 * (portfolio, repos, artifacts, jobs, sessions, accounts).
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
    }
    const userId = user?.id ?? session.user.id;

    await prisma.$transaction(
      async (tx) => {
        const portfolio = await tx.portfolio.findUnique({
          where: { userId },
          select: { id: true, repos: { select: { id: true } } },
        });

        if (portfolio) {
          const repoIds = portfolio.repos.map((r) => r.id);
          if (repoIds.length > 0) {
            await tx.repoArtifact.deleteMany({ where: { portfolioRepoId: { in: repoIds } } });
            await tx.job.deleteMany({ where: { portfolioRepoId: { in: repoIds } } });
          }
          await tx.portfolioRepo.deleteMany({ where: { portfolioId: portfolio.id } });
          await tx.portfolioTimelineEntry.deleteMany({ where: { portfolioId: portfolio.id } });
          await tx.portfolio.delete({ where: { id: portfolio.id } });
        }

        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.user.deleteMany({ where: { id: userId } });
      },
      { timeout: 15000 }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/account/delete]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete account", details: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
