import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await prisma.portfolio.findUnique({ where: { userId: session.user.id } });
  if (!portfolio) return NextResponse.json({ error: "No portfolio" }, { status: 404 });

  const body = await req.json();
  const { bio, socialsJson, isPublished, theme } = body as {
    bio?: string;
    socialsJson?: Record<string, string>;
    isPublished?: boolean;
    theme?: string;
  };

  const data: { bio?: string; socialsJson?: string; isPublished?: boolean; theme?: string } = {};
  if (bio !== undefined) data.bio = bio;
  if (socialsJson !== undefined) data.socialsJson = JSON.stringify(socialsJson);
  if (isPublished !== undefined) data.isPublished = isPublished;
  if (theme !== undefined) data.theme = theme;

  const updated = await prisma.portfolio.update({
    where: { id: portfolio.id },
    data,
  });
  return NextResponse.json(updated);
}
