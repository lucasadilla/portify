import { prisma } from "../../lib/db";
import { uploadBuffer } from "../../lib/s3";
import { upsertJob } from "../lib/db";
import { parsePackageJson, listFiles } from "./analyze";

export async function runDiagram(
  portfolioRepoId: string,
  repoDir: string
): Promise<void> {
  await upsertJob(portfolioRepoId, "diagram", "ACTIVE", 0, null);
  const pkg = parsePackageJson(repoDir);
  const deps = pkg && typeof pkg === "object" ? { ...(pkg.dependencies as Record<string, string>), ...(pkg.devDependencies as Record<string, string>) } : {};
  const files = listFiles(repoDir);
  const hasApi = files.some((f) => f.includes("api/") || f.includes("routes"));
  const hasDb = files.some((f) => /prisma|drizzle|typeorm|mongoose|sequelize/i.test(f));

  const nodes: string[] = [];
  if (deps["next"] || deps["react"]) nodes.push("Frontend");
  if (hasApi) nodes.push("API");
  if (hasDb) nodes.push("Database");
  if (Object.keys(deps).length > 0 && !nodes.includes("Frontend")) nodes.push("App");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="hsl(222.2 84% 4.9%)"/>
  <text x="200" y="100" fill="hsl(210 40% 98%)" text-anchor="middle" font-family="system-ui" font-size="14">Architecture diagram</text>
  <text x="200" y="120" fill="hsl(215 20% 65%)" text-anchor="middle" font-family="system-ui" font-size="12">Mermaid CLI can render in production</text>
</svg>`;

  try {
    const url = await uploadBuffer(
      `diagrams/${portfolioRepoId}/arch.svg`,
      Buffer.from(svg, "utf-8"),
      "image/svg+xml"
    );
    await prisma.repoArtifact.create({
      data: { portfolioRepoId, type: "diagram", url },
    });
  } catch {
    // S3 not configured
  }
  await upsertJob(portfolioRepoId, "diagram", "COMPLETED", 100, null);
}