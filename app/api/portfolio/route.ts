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
  const {
    bio,
    socialsJson,
    isPublished,
    theme,
    slug: newSlug,
    backgroundStyle: bgStyle,
    backgroundOptionsJson: bgOptions,
    displayName,
    imageUrl,
    sectionOrder,
    contributionsChartOrder,
    colorPalette: colorPaletteBody,
  } = body as {
    bio?: string;
    socialsJson?: Record<string, string>;
    isPublished?: boolean;
    theme?: string;
    slug?: string;
    backgroundStyle?: string;
    backgroundOptionsJson?: string | null;
    displayName?: string | null;
    imageUrl?: string | null;
    sectionOrder?: string[] | null;
    contributionsChartOrder?: string[] | null;
    colorPalette?: string | null;
  };

  const data: {
    bio?: string;
    socialsJson?: string;
    isPublished?: boolean;
    theme?: string;
    slug?: string;
    backgroundStyle?: string;
    backgroundOptionsJson?: string | null;
    displayName?: string | null;
    imageUrl?: string | null;
    sectionOrderJson?: string | null;
    contributionsChartOrderJson?: string | null;
    colorPalette?: string | null;
  } = {};
  if (bio !== undefined) data.bio = bio;
  if (socialsJson !== undefined) data.socialsJson = JSON.stringify(socialsJson);
  if (isPublished !== undefined) data.isPublished = isPublished;
  if (theme !== undefined) data.theme = theme;
  if (bgStyle !== undefined) data.backgroundStyle = bgStyle;
  if (bgOptions !== undefined) data.backgroundOptionsJson = bgOptions === "" ? null : bgOptions;
  if (displayName !== undefined) data.displayName = displayName === "" ? null : displayName;
  if (imageUrl !== undefined) data.imageUrl = imageUrl === "" ? null : imageUrl;
  if (sectionOrder !== undefined) data.sectionOrderJson = Array.isArray(sectionOrder) ? JSON.stringify(sectionOrder) : null;
  if (contributionsChartOrder !== undefined) data.contributionsChartOrderJson = Array.isArray(contributionsChartOrder) ? JSON.stringify(contributionsChartOrder) : null;
  if (colorPaletteBody !== undefined) data.colorPalette = colorPaletteBody === "" ? null : colorPaletteBody;

  if (newSlug !== undefined) {
    const slug = newSlug.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug.length < 2) {
      return NextResponse.json({ error: "URL name must be at least 2 characters" }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "URL name can only contain lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }
    if (["demo", "u", "api", "dashboard", "editor"].includes(slug)) {
      return NextResponse.json({ error: "This URL name is reserved" }, { status: 400 });
    }
    const existing = await prisma.portfolio.findUnique({ where: { slug } });
    if (existing && existing.id !== portfolio.id) {
      return NextResponse.json({ error: "This URL name is already taken" }, { status: 400 });
    }
    data.slug = slug;
  }

  const updated = await prisma.portfolio.update({
    where: { id: portfolio.id },
    data,
  });
  return NextResponse.json(updated);
}
