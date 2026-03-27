/**
 * Short display title for charts (not the full user prompt).
 */
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function fallbackTitle(question: string): string {
  const t = question.replace(/\s+/g, " ").trim();
  if (t.length <= 56) return t;
  return `${t.slice(0, 53)}…`;
}

export async function generateChartTitle(question: string): Promise<string> {
  const q = question.slice(0, 600);
  if (!openai) return fallbackTitle(q);

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Reply with a concise chart title only: maximum 8 words, title case, no quotes, no trailing period. Describe what the chart shows, not the user's instructions.",
        },
        { role: "user", content: q },
      ],
      temperature: 0.25,
      max_tokens: 40,
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (text && text.length > 2) return text.slice(0, 80);
  } catch {
    // ignore
  }
  return fallbackTitle(q);
}
