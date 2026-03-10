import OpenAI from "openai";
import type { RepoFacts } from "@/worker/lib/repoFacts";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function generateSummary(input: {
  readme: string;
  packageJson: string;
  languages: string[];
  keyFolders: string[];
}): Promise<{ summary: string; techStack: string[]; features: string[] }> {
  if (!openai) {
    return {
      summary: "Summary generation requires OPENAI_API_KEY.",
      techStack: input.languages.length ? input.languages : ["Unknown"],
      features: [],
    };
  }
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a technical writer. Return a JSON object with keys: summary (one paragraph string), techStack (array of technology names), features (array of short feature strings). No markdown, only valid JSON.",
      },
      {
        role: "user",
        content: `README:\n${input.readme.slice(0, 4000)}\n\npackage.json (if any):\n${input.packageJson.slice(0, 2000)}\n\nLanguages: ${input.languages.join(", ")}\nKey folders: ${input.keyFolders.join(", ")}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { summary?: string; techStack?: string[]; features?: string[] };
  return {
    summary: parsed.summary ?? "No summary generated.",
    techStack: Array.isArray(parsed.techStack) ? parsed.techStack : input.languages.length ? input.languages : ["Unknown"],
    features: Array.isArray(parsed.features) ? parsed.features : [],
  };
}

export type DiagramPlan = {
  [kind in "architecture" | "data-flow" | "api-routes" | "db-schema" | "dependency-graph" | "sequence"]?: {
    title: string;
    description: string;
  };
};

export async function generateDiagramPlan(input: {
  repoName: string;
  facts: RepoFacts;
}): Promise<DiagramPlan> {
  if (!openai) return {};

  const payload = {
    repoName: input.repoName,
    detected: input.facts.detected,
    ports: input.facts.ports,
    folders: input.facts.folders.slice(0, 20),
    routeHints: input.facts.routeHints.slice(0, 20),
    dbHints: input.facts.dbHints.slice(0, 20),
  };

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a senior software architect. Given repo facts, design high-level diagrams. Return JSON with keys 'architecture', 'data-flow', 'api-routes', 'db-schema', 'dependency-graph', 'sequence'. Each key, when present, must map to an object { title: string, description: string }. Keep descriptions concise (1–2 sentences), no markdown.",
      },
      {
        role: "user",
        content: JSON.stringify(payload).slice(0, 6000),
      },
    ],
    response_format: { type: "json_object" },
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(text) as DiagramPlan;
    return parsed ?? {};
  } catch {
    return {};
  }
}
