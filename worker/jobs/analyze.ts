import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { RunPlan } from "../../lib/stackDetector";

const REPO_BASE = process.env.WORKER_REPO_DIR ?? path.join(process.cwd(), ".repos");

export function cloneRepo(repoFullName: string, branch: string, accessToken?: string): string {
  const dir = path.join(REPO_BASE, repoFullName.replace(/\//g, "-"));
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const url = accessToken
    ? `https://x-access-token:${accessToken}@github.com/${repoFullName}.git`
    : `https://github.com/${repoFullName}.git`;
  execSync(`git clone --depth 1 --branch "${branch}" "${url}" "${dir}"`, {
    timeout: 60_000,
    stdio: "pipe",
  });
  return dir;
}

export function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      out.push(...listFiles(path.join(dir, e.name), rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

export function readFileSafe(dir: string, file: string): string {
  const p = path.join(dir, file);
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

export function parsePackageJson(dir: string): Record<string, unknown> | null {
  const content = readFileSafe(dir, "package.json");
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function analyzeRepo(
  repoDir: string,
  runPlan: RunPlan
): Promise<{ readme: string; packageJson: string; languages: string[]; keyFolders: string[] }> {
  const files = listFiles(repoDir);
  const readme =
    readFileSafe(repoDir, "README.md") ||
    readFileSafe(repoDir, "README.MD") ||
    readFileSafe(repoDir, "readme.md") ||
    "";
  const pkg = parsePackageJson(repoDir);
  const packageJson = pkg ? JSON.stringify(pkg) : "";
  const languages = inferLanguages(files, pkg);
  const keyFolders = inferKeyFolders(files);
  return { readme, packageJson, languages, keyFolders };
}

function inferLanguages(files: string[], pkg: Record<string, unknown> | null): string[] {
  const extCount: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f).slice(1);
    if (ext) extCount[ext] = (extCount[ext] ?? 0) + 1;
  }
  const langMap: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    py: "Python",
    go: "Go",
    rs: "Rust",
    java: "Java",
    kt: "Kotlin",
    css: "CSS",
    scss: "SCSS",
    html: "HTML",
    vue: "Vue",
    svelte: "Svelte",
  };
  const names = new Set<string>();
  for (const [ext, count] of Object.entries(extCount)) {
    const name = langMap[ext.toLowerCase()];
    if (name && count > 0) names.add(name);
  }
  if (pkg && typeof pkg === "object") {
    const deps = { ...(pkg.dependencies as Record<string, string>), ...(pkg.devDependencies as Record<string, string>) };
    if (deps["react"]) names.add("React");
    if (deps["vue"]) names.add("Vue");
    if (deps["next"]) names.add("Next.js");
    if (deps["express"]) names.add("Express");
  }
  return Array.from(names);
}

function inferKeyFolders(files: string[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split(/[/\\]/);
    if (parts.length > 1) dirs.add(parts[0]);
  }
  const priority = ["src", "app", "pages", "lib", "components", "api", "server"];
  return priority.filter((d) => dirs.has(d)).concat(Array.from(dirs).filter((d) => !priority.includes(d)).slice(0, 5));
}
