import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: repoId } = await params;
  const repo = await prisma.portfolioRepo.findFirst({
    where: { id: repoId },
    include: { portfolio: true },
  });
  if (!repo || repo.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { type, url, metadata } = body as {
    type: "screenshot" | "diagram";
    url?: string;
    metadata?: { caption?: string; description?: string };
  };

  if (type !== "screenshot" && type !== "diagram") {
    return NextResponse.json(
      { error: "type must be screenshot or diagram" },
      { status: 400 }
    );
  }
  const urlStr = typeof url === "string" ? url.trim() : "";
  if (!urlStr) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    return NextResponse.json({ error: "url must be http or https" }, { status: 400 });
  }

  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  const artifact = await prisma.repoArtifact.create({
    data: {
      portfolioRepoId: repoId,
      type,
      url: urlStr,
      metadata: metadataStr,
    },
  });
  return NextResponse.json(artifact);
}
