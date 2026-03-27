/**
 * SQL result → narrative insights + recommendations (OpenAI).
 */

import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export type InsightsContext = {
  /** Rows in commits table after seeding (before/after SQL). */
  commitsInDataset?: number;
};

export async function generateInsights(
  result: unknown,
  question: string,
  ctx?: InsightsContext
): Promise<string> {
  if (Array.isArray(result) && result.length === 0) {
    const hasData = (ctx?.commitsInDataset ?? 0) > 0;
    if (hasData) {
      return [
        "The first SQL query for your question matched no rows, but activity data was loaded successfully.",
        "A fallback monthly summary was used so the chart still has something to plot — check **Generated SQL** if the numbers look broader than your exact date range.",
        "",
        "Tip: ask again with an explicit range that falls inside your data (see the table of months if shown), or phrase it as “monthly contributions for the last 12 months”.",
      ].join("\n");
    }
    return [
      "There is no activity data in the dataset for this run (no rows in the commits table).",
      "",
      "- Sign in with GitHub so we can load your contribution graph, run portfolio sync/generate, or ensure at least one repo has processed commit history.",
      "- Then try your question again.",
    ].join("\n");
  }

  const payload = JSON.stringify(result, null, 2).slice(0, 12000);
  if (!openai) {
    return "Insight generation requires OPENAI_API_KEY. Results are shown in the table above.";
  }

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a developer success coach. Given a user question and JSON query results from their GitHub portfolio data, explain what the data shows in 2–4 short paragraphs. Then add a bullet list of 2–3 concrete, actionable recommendations (improve maintenance, focus repos, diversify languages, etc.). Use plain language, no SQL jargon. If the result set is empty, say so and suggest how to rephrase.",
      },
      {
        role: "user",
        content: `Question: ${question}\n\nResult JSON:\n${payload}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 800,
  });
  return res.choices[0]?.message?.content?.trim() ?? "Could not generate insights.";
}
