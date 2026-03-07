import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.portfolioTimelineEntry.findFirst({
    where: { id },
    include: { portfolio: true },
  });
  if (!entry || entry.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { date, title, subtitle, kind } = body as {
    date?: string;
    title?: string;
    subtitle?: string | null;
    kind?: string;
  };

  const data: { date?: string; year?: number; title?: string; subtitle?: string | null; kind?: string } = {};
  if (date !== undefined) {
    const dateStr = String(date).trim();
    const yearMatch = dateStr.match(/^(\d{4})(?:-(\d{2}))?/);
    data.date = dateStr.length === 4 ? `${dateStr}-01` : dateStr;
    data.year = yearMatch ? parseInt(yearMatch[1], 10) : entry.year;
  }
  if (title !== undefined) data.title = String(title).trim();
  if (subtitle !== undefined) data.subtitle = subtitle && String(subtitle).trim() ? String(subtitle).trim() : null;
  if (kind !== undefined) data.kind = String(kind).trim() || "custom";

  const updated = await prisma.portfolioTimelineEntry.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.portfolioTimelineEntry.findFirst({
    where: { id },
    include: { portfolio: true },
  });
  if (!entry || entry.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.portfolioTimelineEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
