import * as path from "path";
import { listFiles, parsePackageJson } from "../jobs/analyze";

export interface RepoFacts {
  repoName: string;
  detected: {
    frontend?: string;
    backend?: string;
    database?: string;
    orm?: string;
    auth: string[];
    cache: string[];
    queue: string[];
    deploy: string[];
  };
  ports: number[];
  folders: string[];
  routeHints: string[];
  dbHints: string[];
}

export async function extractRepoFacts(repoDir: string): Promise<RepoFacts> {
  const files = listFiles(repoDir);
  const pkg = parsePackageJson(repoDir);
  const repoName = path.basename(repoDir);

  const deps =
    pkg && typeof pkg === "object"
      ? {
          ...(pkg.dependencies as Record<string, string> | undefined),
          ...(pkg.devDependencies as Record<string, string> | undefined),
        }
      : {};

  const depNames = new Set(Object.keys(deps || {}));

  const topLevelFolders = Array.from(
    new Set(
      files
        .map((f) => f.split(/[/\\]/)[0])
        .filter((f) => !!f && !f.startsWith("."))
    )
  );

  const routeHints: string[] = [];
  const dbHints: string[] = [];

  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower.startsWith("app/api") || lower.includes("/api/") || lower.includes("/routes")) {
      routeHints.push(f);
    }
    if (lower.includes("prisma/schema.prisma") || lower.includes("migrations") || lower.includes("db/")) {
      dbHints.push(f);
    }
  }

  let frontend: string | undefined;
  if (depNames.has("next")) frontend = "Next.js";
  else if (depNames.has("vite")) frontend = "Vite";
  else if (depNames.has("react")) frontend = "React";

  let backend: string | undefined;
  if (routeHints.length && depNames.has("next")) backend = "Next API routes";
  else if (depNames.has("express")) backend = "Express API";

  let database: string | undefined;
  if (depNames.has("pg") || depNames.has("@vercel/postgres")) database = "PostgreSQL";
  else if (depNames.has("mongoose")) database = "MongoDB";
  else if (depNames.has("mysql2")) database = "MySQL";

  let orm: string | undefined;
  if (depNames.has("@prisma/client") || depNames.has("prisma")) orm = "Prisma";
  else if (depNames.has("mongoose")) orm = "Mongoose";

  const auth: string[] = [];
  if (depNames.has("next-auth") || depNames.has("@auth/core")) auth.push("NextAuth");
  if (depNames.has("@octokit/rest") || depNames.has("@octokit/core")) auth.push("GitHub OAuth");

  const cache: string[] = [];
  if (depNames.has("ioredis") || depNames.has("redis")) cache.push("Redis");

  const queue: string[] = [];
  if (depNames.has("bullmq")) queue.push("BullMQ");

  const deploy: string[] = [];
  if (files.some((f) => f === "vercel.json")) deploy.push("Vercel");

  const ports = new Set<number>();
  if (frontend === "Next.js") ports.add(3000);
  if (frontend === "Vite") ports.add(5173);
  if (backend === "Express API" && !ports.size) ports.add(3000);

  return {
    repoName,
    detected: {
      frontend,
      backend,
      database,
      orm,
      auth,
      cache,
      queue,
      deploy,
    },
    ports: Array.from(ports),
    folders: topLevelFolders,
    routeHints,
    dbHints,
  };
}

