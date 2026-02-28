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
  const repo = await prisma.portfolioRepo.findFirst({
    where: { id },
    include: { portfolio: true },
  });
  if (!repo || repo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { customTitle, customSummary, pinnedOrder } = body as {
    customTitle?: string;
    customSummary?: string;
    pinnedOrder?: number;
  };

  const data: { customTitle?: string; customSummary?: string; pinnedOrder?: number } = {};
  if (customTitle !== undefined) data.customTitle = customTitle;
  if (customSummary !== undefined) data.customSummary = customSummary;
  if (pinnedOrder !== undefined) data.pinnedOrder = pinnedOrder;

  const updated = await prisma.portfolioRepo.update({
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
  const repo = await prisma.portfolioRepo.findFirst({
    where: { id },
    include: { portfolio: true },
  });
  if (!repo || repo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.portfolioRepo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
