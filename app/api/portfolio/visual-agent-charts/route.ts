import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sessionCanEditPortfolio } from "@/lib/portfolioAccess";
import { isRechartsPayload } from "@/lib/agentVisualization";
import { parseVisualAgentChartsJson, type SavedVisualAgentChart } from "@/lib/visualAgentCharts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    portfolioId?: string;
    question?: string;
    title?: string;
    mermaidSource?: string;
    recharts?: unknown;
    insights?: string;
    sql?: string;
    url?: string;
  };

  if (!body.portfolioId || typeof body.portfolioId !== "string") {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: body.portfolioId },
    include: { user: true },
  });
  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  if (!sessionCanEditPortfolio(session, portfolio)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const question = typeof body.question === "string" ? body.question : "";
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const mermaidSource = typeof body.mermaidSource === "string" ? body.mermaidSource : "";
  const url = typeof body.url === "string" ? body.url : "";
  const recharts = isRechartsPayload(body.recharts) ? body.recharts : null;
  const displayKind: "recharts" | "mermaid" = recharts ? "recharts" : "mermaid";

  if (displayKind === "mermaid" && (!mermaidSource.trim() || !url.trim())) {
    return NextResponse.json({ error: "mermaidSource and url required for diagram saves" }, { status: 400 });
  }
  if (displayKind === "recharts" && !recharts) {
    return NextResponse.json({ error: "recharts payload required for chart saves" }, { status: 400 });
  }

  const charts = parseVisualAgentChartsJson(portfolio.visualAgentChartsJson);
  const chart: SavedVisualAgentChart = {
    id: crypto.randomUUID(),
    question,
    title,
    displayKind,
    recharts: recharts ?? undefined,
    mermaidSource: displayKind === "mermaid" ? mermaidSource : "",
    insights: typeof body.insights === "string" ? body.insights : "",
    sql: typeof body.sql === "string" ? body.sql : "",
    url: url || "",
    createdAt: new Date().toISOString(),
  };
  charts.push(chart);

  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: { visualAgentChartsJson: JSON.stringify(charts) },
  });

  return NextResponse.json({ chart });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const portfolioId = searchParams.get("portfolioId");
  const chartId = searchParams.get("chartId");
  if (!portfolioId || !chartId) {
    return NextResponse.json({ error: "portfolioId and chartId required" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { user: true },
  });
  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  if (!sessionCanEditPortfolio(session, portfolio)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const charts = parseVisualAgentChartsJson(portfolio.visualAgentChartsJson).filter((c) => c.id !== chartId);
  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: { visualAgentChartsJson: charts.length ? JSON.stringify(charts) : null },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    portfolioId?: string;
    chartId?: string;
    title?: string;
  };

  if (!body.portfolioId || !body.chartId) {
    return NextResponse.json({ error: "portfolioId and chartId required" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: body.portfolioId },
    include: { user: true },
  });
  if (!portfolio) return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  if (!sessionCanEditPortfolio(session, portfolio)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const charts = parseVisualAgentChartsJson(portfolio.visualAgentChartsJson).map((c) =>
    c.id === body.chartId ? { ...c, title: title || undefined } : c
  );

  await prisma.portfolio.update({
    where: { id: portfolio.id },
    data: { visualAgentChartsJson: JSON.stringify(charts) },
  });

  return NextResponse.json({ ok: true });
}
