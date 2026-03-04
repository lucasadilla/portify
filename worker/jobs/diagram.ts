import * as path from "path";
import { prisma } from "../../lib/db";
import { s3, uploadBuffer } from "../../lib/s3";
import { upsertJob } from "../lib/db";
import { extractRepoFacts, type RepoFacts } from "../lib/repoFacts";

function systemMermaid(facts: RepoFacts): string {
  const lines: string[] = ["flowchart TD", "  user[User]"];
  const { frontend, backend, database, auth, cache } = facts.detected;

  if (frontend) lines.push(`  frontend[Frontend: ${frontend}]`);
  if (backend) lines.push(`  backend[Backend: ${backend}]`);
  if (database) lines.push(`  db[(Database: ${database})]`);

  if (frontend && backend) {
    lines.push("  user --> frontend");
    lines.push("  frontend --> backend");
  } else if (frontend) {
    lines.push("  user --> frontend");
  } else if (backend) {
    lines.push("  user --> backend");
  } else {
    lines.push("  user --> app[App]");
  }

  if (backend && database) lines.push("  backend --> db");
  else if (!backend && database && frontend) lines.push("  frontend --> db");

  auth.forEach((a, idx) => {
    const id = `auth${idx}`;
    lines.push(`  ${id}[Auth: ${a}]`);
    if (backend) lines.push(`  ${id} --- backend`);
    else if (frontend) lines.push(`  ${id} --- frontend`);
  });

  cache.forEach((c, idx) => {
    const id = `cache${idx}`;
    lines.push(`  ${id}[Cache: ${c}]`);
    if (backend) lines.push(`  backend --- ${id}`);
  });

  return lines.join("\n");
}

function structureMermaid(facts: RepoFacts): string {
  const lines: string[] = ["flowchart TD", `  repo(["${facts.repoName}"])`];
  const max = 12;
  facts.folders.slice(0, max).forEach((folder, idx) => {
    const id = `f${idx}`;
    lines.push(`  ${id}[${folder}/]`);
    lines.push(`  repo --> ${id}`);
  });
  return lines.join("\n");
}

function renderSystemSvg(facts: RepoFacts): Buffer {
  const { frontend, backend, database, auth, cache } = facts.detected;
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(215 20% 80%)" />
    </marker>
  </defs>
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">System architecture</text>

  <rect x="40" y="80" width="100" height="40" rx="8" ry="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="90" y="105" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="12">User</text>

  ${frontend ? `<rect x="200" y="80" width="140" height="40" rx="8" ry="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="270" y="100" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="12">Frontend: ${esc(
    frontend
  )}</text>
  <line x1="140" y1="100" x2="200" y2="100" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>` : ""}

  ${backend ? `<rect x="400" y="80" width="160" height="40" rx="8" ry="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="480" y="100" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="12">Backend: ${esc(
    backend
  )}</text>
  ${frontend ? `<line x1="340" y1="100" x2="400" y2="100" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>` : `<line x1="140" y1="100" x2="400" y2="100" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>`}` : ""}

  ${database ? `<ellipse cx="480" cy="190" rx="70" ry="28" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="480" y="195" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="12">DB: ${esc(
    database
  )}</text>
  <line x1="${backend ? 480 : 340}" y1="120" x2="480" y2="162" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>` : ""}

  ${auth
    .map(
      (a, i) => `<rect x="40" y="${160 + i * 40}" width="140" height="32" rx="8" ry="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="110" y="${180 + i * 40}" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="11">Auth: ${esc(
    a
  )}</text>
  <line x1="180" y1="${176 + i * 40}" x2="${backend ? 400 : 200}" y2="100" stroke="hsl(215 20% 80%)" stroke-width="1.5" marker-end="url(#arrow)"/>`
    )
    .join("\n")}

  ${cache
    .map(
      (c, i) => `<rect x="220" y="${170 + i * 40}" width="120" height="32" rx="8" ry="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="280" y="${190 + i * 40}" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="11">Cache: ${esc(
    c
  )}</text>
  <line x1="340" y1="${186 + i * 40}" x2="${backend ? 400 : 200}" y2="100" stroke="hsl(215 20% 80%)" stroke-width="1.5" marker-end="url(#arrow)"/>`
    )
    .join("\n")}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

function renderStructureSvg(facts: RepoFacts): Buffer {
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const max = 12;
  const folders = facts.folders.slice(0, max);
  const cols = 4;
  const startX = 60;
  const startY = 120;
  const colWidth = 130;
  const rowHeight = 60;

  const folderRects = folders
    .map((folder, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * colWidth;
      const y = startY + row * rowHeight;
      return `<rect x="${x}" y="${y}" width="110" height="36" rx="8" ry="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + 55}" y="${y + 22}" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="11">${esc(
    folder
  )}/</text>
  <line x1="320" y1="90" x2="${x + 55}" y2="${y}" stroke="hsl(215 20% 80%)" stroke-width="1.5"/>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">Repo structure</text>

  <rect x="260" y="56" width="120" height="40" rx="10" ry="10" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="320" y="80" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="12">${esc(
    facts.repoName
  )}</text>

  ${folderRects}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

async function storeDiagram(
  portfolioRepoId: string,
  kind: "system" | "structure",
  svg: Buffer,
  mermaid: string,
  facts: RepoFacts
): Promise<void> {
  const keyBase = `diagrams/${portfolioRepoId}/${kind}.svg`;
  let url: string;
  if (s3) {
    url = await uploadBuffer(keyBase, svg, "image/svg+xml");
  } else {
    url = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  }
  await prisma.repoArtifact.create({
    data: {
      portfolioRepoId,
      type: "diagram",
      url,
      metadata: JSON.stringify({ kind, mermaid, facts: { ...facts, folders: facts.folders.slice(0, 20) } }),
    },
  });
}

export async function runDiagram(portfolioRepoId: string, repoDir: string): Promise<void> {
  await upsertJob(portfolioRepoId, "diagram", "ACTIVE", 0, null);
  try {
    const facts = await extractRepoFacts(repoDir);
    const system = systemMermaid(facts);
    const structure = structureMermaid(facts);
    const systemSvg = renderSystemSvg(facts);
    const structureSvg = renderStructureSvg(facts);
    await storeDiagram(portfolioRepoId, "system", systemSvg, system, facts);
    await storeDiagram(portfolioRepoId, "structure", structureSvg, structure, facts);
    await upsertJob(portfolioRepoId, "diagram", "COMPLETED", 100, null);
  } catch (err) {
    const fallback = svgFromMermaid("Architecture", "Diagram unavailable");
    try {
      await storeDiagram(
        portfolioRepoId,
        "system",
        fallback,
        "Diagram unavailable",
        {
          repoName: path.basename(repoDir),
          detected: { auth: [], cache: [], queue: [], deploy: [] },
          ports: [],
          folders: [],
          routeHints: [],
          dbHints: [],
        }
      );
    } catch {
      // ignore
    }
    await upsertJob(portfolioRepoId, "diagram", "COMPLETED", 100, err instanceof Error ? err.message : String(err));
  }
}
