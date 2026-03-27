/**
 * Query result → Mermaid diagram (OpenAI). Returns Mermaid source only.
 */

import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function generateMermaid(result: unknown, question: string): Promise<string> {
  const payload = JSON.stringify(result, null, 2).slice(0, 8000);
  if (!openai) {
    return `pie title Languages\n  "Data": 1`;
  }

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You output ONLY valid Mermaid diagram code (no markdown fences, no commentary).
Pick ONE diagram type that fits the data:
- pie chart: pie title ... / "Label": value
- bar-style comparisons: xychart-beta or simple flowchart
- relationships: graph TD or flowchart LR with short node ids
- timeline: timeline when dates are central

Rules:
- If each row has "language" and "percentage" (or similar numeric weight), use a pie chart: pie title ... then one line per row like "Label": number using the percentage as the slice value.
- Use ASCII-only labels where possible; keep labels short.
- No HTML in labels.
- If data is empty, output: flowchart TD
    A[No data] --> B[Try another question]`,
      },
      {
        role: "user",
        content: `User question: ${question}\n\nData (JSON):\n${payload}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 600,
  });
  let text = res.choices[0]?.message?.content?.trim() ?? "flowchart TD\n  A[Empty]";
  text = text.replace(/^```mermaid\s*/i, "").replace(/```\s*$/u, "").trim();
  return text;
}
