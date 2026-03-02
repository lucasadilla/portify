import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: {
      repos: {
        orderBy: { pinnedOrder: "asc" },
        include: { artifacts: true },
      },
    },
  });
  if (!portfolio) return NextResponse.json({ portfolio: null });
  return NextResponse.json({
    portfolio: {
      ...portfolio,
      socialsJson: portfolio.socialsJson ? JSON.parse(portfolio.socialsJson) : {},
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { slug, repoFullName, branch } = body as { slug?: string; repoFullName: string; branch?: string };
  if (!repoFullName) return NextResponse.json({ error: "repoFullName required" }, { status: 400 });

  let portfolio = await prisma.portfolio.findUnique({ where: { userId: session.user.id } });
  if (!portfolio) {
    const username = session.user.username || session.user.name || "user";
    const baseSlug = username.replace(/\s+/g, "-").toLowerCase();
    let uniqueSlug = baseSlug;
    let n = 0;
    while (await prisma.portfolio.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${++n}`;
    }
    portfolio = await prisma.portfolio.create({
      data: { userId: session.user.id, slug: uniqueSlug },
    });
  }

  const existing = await prisma.portfolioRepo.findUnique({
    where: { portfolioId_repoFullName: { portfolioId: portfolio.id, repoFullName } },
  });
  if (existing) return NextResponse.json({ portfolio, repo: existing });

  const maxOrder = await prisma.portfolioRepo
    .aggregate({ where: { portfolioId: portfolio.id }, _max: { pinnedOrder: true } })
    .then((r) => (r._max.pinnedOrder ?? -1) + 1);

  const repo = await prisma.portfolioRepo.create({
    data: {
      portfolioId: portfolio.id,
      repoFullName,
      branch: branch ?? "main",
      pinnedOrder: maxOrder,
      // Start in an idle state; generation only begins when the user clicks "Generate"
      status: "DONE",
    },
  });
  return NextResponse.json({ portfolio, repo });
}
