import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessToken } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addGenerateJob } from "@/lib/jobQueue";
import { getAllGitHubRepos } from "@/lib/github";

/**
 * POST /api/portfolio/sync
 * Ensures portfolio exists, adds all public GitHub repos that aren't already
 * in the portfolio, and queues generation for each new repo.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "GitHub token missing" }, { status: 400 });

  let portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: { repos: { select: { id: true, repoFullName: true } } },
  });
  if (!portfolio) {
    const username = session.user.username || session.user.name || "user";
    const baseSlug = username.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
    let uniqueSlug = baseSlug || "user";
    let n = 0;
    while (await prisma.portfolio.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${++n}`;
    }
    portfolio = await prisma.portfolio.create({
      data: { userId: session.user.id, slug: uniqueSlug },
      include: { repos: { select: { id: true, repoFullName: true } } },
    });
  }

  const existingNames = new Set(portfolio.repos.map((r) => r.repoFullName.toLowerCase()));
  const githubRepos = await getAllGitHubRepos(token);
  const toAdd = githubRepos.filter((r) => !existingNames.has(r.fullName.toLowerCase()));

  const added: string[] = [];
  const maxOrder = await prisma.portfolioRepo
    .aggregate({ where: { portfolioId: portfolio.id }, _max: { pinnedOrder: true } })
    .then((r) => (r._max.pinnedOrder ?? -1) + 1);

  for (let i = 0; i < toAdd.length; i++) {
    const r = toAdd[i];
    const repo = await prisma.portfolioRepo.create({
      data: {
        portfolioId: portfolio.id,
        repoFullName: r.fullName,
        branch: r.defaultBranch,
        pinnedOrder: maxOrder + i,
        status: "QUEUED",
      },
    });
    added.push(repo.id);
    try {
      await addGenerateJob({
        portfolioRepoId: repo.id,
        portfolioId: portfolio.id,
        repoFullName: repo.repoFullName,
        branch: repo.branch,
        accessToken: token,
      });
    } catch {
      await prisma.portfolioRepo.update({
        where: { id: repo.id },
        data: { status: "FAILED" },
      });
    }
  }

  return NextResponse.json({
    portfolio: { id: portfolio.id, slug: portfolio.slug },
    added: added.length,
    repoIds: added,
  });
}
