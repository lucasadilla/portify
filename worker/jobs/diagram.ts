import * as path from "path";
import { prisma } from "../../lib/db";
import { s3, uploadBuffer } from "../../lib/s3";
import { upsertJob } from "../lib/db";
import { extractRepoFacts, type RepoFacts } from "../lib/repoFacts";
import { parsePackageJson } from "./analyze";
import { generateDiagramPlan } from "../../lib/openai";

export type DiagramKind =
  | "architecture"
  | "db-schema"
  | "sequence";

function placeholderSvg(title: string, message: string): Buffer {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="320" y="140" text-anchor="middle" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">${title}</text>
  <text x="320" y="170" text-anchor="middle" fill="hsl(215 20% 65%)" font-family="system-ui" font-size="14">${message}</text>
</svg>`;
  return Buffer.from(svg, "utf-8");
}

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

function renderDataFlowSvg(facts: RepoFacts): Buffer {
  const { frontend, backend, database } = facts.detected;
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const nodes: string[] = [];
  const arrows: string[] = [];
  let x = 80;
  nodes.push(`<rect x="${x}" y="120" width="90" height="36" rx="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + 45}" y="142" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="11">User</text>`);
  x += 120;
  if (frontend) {
    nodes.push(`<rect x="${x}" y="120" width="100" height="36" rx="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + 50}" y="142" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="11">${esc(frontend)}</text>`);
    arrows.push(`<line x1="170" y1="138" x2="${x}" y2="138" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="${170 + (x - 170) / 2}" y="128" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="9">request</text>`);
    x += 120;
  }
  if (backend) {
    nodes.push(`<rect x="${x}" y="120" width="110" height="36" rx="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + 55}" y="142" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="11">${esc(backend)}</text>`);
    arrows.push(`<line x1="${x - 120}" y1="138" x2="${x}" y2="138" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="${x - 60}" y="128" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="9">data</text>`);
    x += 130;
  }
  if (database) {
    nodes.push(`<ellipse cx="${x + 40}" cy="138" rx="50" ry="24" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + 40}" y="142" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="11">${esc(database)}</text>`);
    arrows.push(`<line x1="${x - 20}" y1="138" x2="${x}" y2="138" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="${x - 10}" y="128" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="9">query</text>`);
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(215 20% 80%)"/></marker></defs>
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">Data flow</text>
  ${nodes.join("\n  ")}
  ${arrows.join("\n  ")}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

function renderApiRoutesSvg(facts: RepoFacts): Buffer {
  const routes = facts.routeHints.slice(0, 14).map((r) => r.replace(/^.*?(app\/api\/|routes\/|api\/)/i, "$1").replace(/\/route\.(ts|tsx|js)$/i, "") || r);
  const esc = (s: string) => s.replace(/&/g, "&amp;").slice(0, 28);
  const rows = routes.map((r, i) => {
    const y = 72 + i * 22;
    return `<rect x="24" y="${y}" width="400" height="20" rx="4" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="32" y="${y + 14}" fill="hsl(210 40% 98%)" font-size="11">${esc(r)}</text>`;
  }).join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">API route map</text>
  ${routes.length ? rows : '<text x="320" y="160" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="14">No API routes detected</text>'}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

function renderDbSchemaSvg(facts: RepoFacts): Buffer {
  const { database, orm } = facts.detected;
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const hasDb = !!database || !!orm || facts.dbHints.length > 0;
  const entities = database ? [database] : orm ? [orm] : facts.dbHints.length ? ["Schema (see migrations)"] : [];
  const rows = entities.map((e, i) => {
    const y = 80 + i * 48;
    return `<rect x="80" y="${y}" width="200" height="40" rx="8" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="180" y="${y + 24}" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="12">${esc(e)}</text>`;
  }).join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">Database schema</text>
  ${hasDb ? rows : '<text x="320" y="160" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="14">No schema detected</text>'}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

function renderDependencyGraphSvg(repoDir: string, repoName: string): Buffer {
  const pkg = parsePackageJson(repoDir);
  const deps = pkg && typeof pkg === "object"
    ? { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) }
    : {};
  const names = Object.keys(deps).slice(0, 16);
  const esc = (s: string) => s.replace(/&/g, "&amp;").slice(0, 18);
  const cols = 4;
  const cellW = 140;
  const cellH = 44;
  const startX = 40;
  const startY = 80;
  const nodes = names.map((name, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    return `<rect x="${x}" y="${y}" width="120" height="32" rx="6" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + 60}" y="${y + 20}" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="10">${esc(name)}</text>`;
  }).join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">Dependency graph</text>
  <text x="320" y="64" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="12">${esc(repoName)}</text>
  ${names.length ? nodes : '<text x="320" y="160" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="14">No dependencies</text>'}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

function renderSequenceSvg(facts: RepoFacts): Buffer {
  const { frontend, backend, database } = facts.detected;
  const esc = (s: string) => s.replace(/&/g, "&amp;");
  const participants = ["User", frontend, backend, database].filter(Boolean);
  const boxW = 100;
  const startX = 80;
  const laneY = 200;
  const partBoxes = participants.map((p, i) => {
    const x = startX + i * (boxW + 24);
    return `<rect x="${x}" y="56" width="${boxW}" height="28" rx="6" fill="hsl(217 33% 17%)" stroke="hsl(215 20% 65%)"/>
  <text x="${x + boxW / 2}" y="74" text-anchor="middle" fill="hsl(210 40% 98%)" font-size="11">${esc(p ?? "?")}</text>
  <line x1="${x + boxW / 2}" y1="84" x2="${x + boxW / 2}" y2="${laneY}" stroke="hsl(215 20% 50%)" stroke-width="1"/>`;
  }).join("\n");
  const arrows: string[] = [];
  for (let i = 0; i < participants.length - 1; i++) {
    const y = 100 + i * 28;
    const x1 = startX + i * (boxW + 24) + boxW / 2;
    const x2 = startX + (i + 1) * (boxW + 24) + boxW / 2;
    arrows.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="hsl(215 20% 80%)" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="${(x1 + x2) / 2}" y="${y - 4}" text-anchor="middle" fill="hsl(215 20% 65%)" font-size="9">request</text>`);
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(215 20% 80%)"/></marker></defs>
  <rect width="640" height="320" rx="16" ry="16" fill="hsl(222.2 84% 4.9%)"/>
  <text x="24" y="36" fill="hsl(210 40% 98%)" font-family="system-ui" font-size="16">Sequence (common flow)</text>
  ${partBoxes}
  ${arrows.join("\n  ")}
</svg>`;
  return Buffer.from(svg, "utf-8");
}

async function storeDiagram(
  portfolioRepoId: string,
  kind: DiagramKind,
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
  const sortOrder = DIAGRAM_ORDER.indexOf(kind);
  const diagramPlan = await generateDiagramPlan({ repoName: facts.repoName, facts });
  await prisma.repoArtifact.create({
    data: {
      portfolioRepoId,
      type: "diagram",
      url,
      sortOrder: sortOrder >= 0 ? sortOrder : 0,
      metadata: JSON.stringify({
        diagramKind: kind,
        kind,
        mermaid,
        facts: { ...facts, folders: facts.folders.slice(0, 20) },
        plan: diagramPlan?.[kind],
      }),
    },
  });
}

const DIAGRAM_ORDER: DiagramKind[] = ["architecture", "db-schema", "sequence"];

const EMPTY_FACTS: RepoFacts = {
  repoName: "",
  detected: { auth: [], cache: [], queue: [], deploy: [] },
  ports: [],
  folders: [],
  routeHints: [],
  dbHints: [],
};

export async function runDiagram(portfolioRepoId: string, repoDir: string): Promise<void> {
  await upsertJob(portfolioRepoId, "diagram", "ACTIVE", 0, null);
  const repoName = path.basename(repoDir);
  try {
    const facts = await extractRepoFacts(repoDir);
    facts.repoName = repoName;

    const plan = await generateDiagramPlan({ repoName, facts });

    const hasArchitectureSignals =
      !!facts.detected.frontend ||
      !!facts.detected.backend ||
      !!facts.detected.database ||
      facts.detected.auth.length > 0 ||
      facts.detected.cache.length > 0;
    const hasDbSignals =
      !!facts.detected.database || !!facts.detected.orm || facts.dbHints.length > 0;

    if (hasArchitectureSignals) {
      await storeDiagram(portfolioRepoId, "architecture", renderSystemSvg(facts), systemMermaid(facts), facts);
    }
    if (hasDbSignals) {
      await storeDiagram(portfolioRepoId, "db-schema", renderDbSchemaSvg(facts), "", facts);
    }
    // Always safe to show dependency snapshot; skip only when there are truly no dependencies.
    if (hasArchitectureSignals || hasDbSignals) {
      await storeDiagram(portfolioRepoId, "sequence", renderSequenceSvg(facts), "", facts);
    }

    await upsertJob(portfolioRepoId, "diagram", "COMPLETED", 100, null);
  } catch (err) {
    const emptyFacts: RepoFacts = { ...EMPTY_FACTS, repoName };
    try {
      await storeDiagram(
        portfolioRepoId,
        "architecture",
        placeholderSvg("Architecture diagram", "Diagram unavailable"),
        "Diagram unavailable",
        emptyFacts
      );
    } catch {
      // ignore
    }
    await upsertJob(portfolioRepoId, "diagram", "COMPLETED", 100, err instanceof Error ? err.message : String(err));
  }
}
