import OpenAI from "openai";

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
