import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: { timelineEntries: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] } },
  });
  if (!portfolio) return NextResponse.json({ entries: [] });
  return NextResponse.json({ entries: portfolio.timelineEntries });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
  });
  if (!portfolio) return NextResponse.json({ error: "No portfolio" }, { status: 404 });

  const body = await req.json();
  const { date, title, subtitle, kind } = body as {
    date: string;
    title: string;
    subtitle?: string | null;
    kind: string;
  };

  const dateStr = typeof date === "string" ? date.trim() : "";
  if (!dateStr) return NextResponse.json({ error: "date is required" }, { status: 400 });
  const yearMatch = dateStr.match(/^(\d{4})(?:-(\d{2}))?/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const titleStr = typeof title === "string" ? title.trim() : "";
  if (!titleStr) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const kindStr = typeof kind === "string" ? kind.trim() || "custom" : "custom";

  const maxOrder = await prisma.portfolioTimelineEntry
    .aggregate({ where: { portfolioId: portfolio.id }, _max: { sortOrder: true } })
    .then((r) => (r._max.sortOrder ?? -1) + 1);

  const entry = await prisma.portfolioTimelineEntry.create({
    data: {
      portfolioId: portfolio.id,
      date: dateStr.length === 4 ? `${dateStr}-01` : dateStr,
      year,
      title: titleStr,
      subtitle: typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null,
      kind: kindStr,
      sortOrder: maxOrder,
    },
  });
  return NextResponse.json(entry);
}
