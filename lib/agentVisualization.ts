/**
 * Map SQL result rows to Recharts payloads (same stack as LanguageChart / EvolutionGraph).
 * Returns null when data is better shown as a Mermaid diagram (flowcharts, etc.).
 */

export type RechartsPiePayload = { variant: "pie"; data: { name: string; value: number }[] };
export type RechartsLinePayload = { variant: "line"; data: { month: string; value: number }[] };
export type RechartsBarPayload = { variant: "bar"; data: { name: string; value: number }[] };

export type RechartsPayload = RechartsPiePayload | RechartsLinePayload | RechartsBarPayload;

export function isRechartsPayload(x: unknown): x is RechartsPayload {
  if (!x || typeof x !== "object") return false;
  const v = (x as { variant?: string }).variant;
  return v === "pie" || v === "line" || v === "bar";
}

function keyMap(row: Record<string, unknown>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    m[k.toLowerCase().replace(/\s+/g, "_")] = k;
  }
  return m;
}

function pick(
  map: Record<string, string>,
  candidates: string[]
): string | null {
  for (const c of candidates) {
    const k = map[c.toLowerCase()];
    if (k) return k;
  }
  return null;
}

function isNumeric(v: unknown): boolean {
  if (typeof v === "number" && !Number.isNaN(v)) return true;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return true;
  return false;
}

/** If SQL rows look like tabular numeric data, render with Recharts; else use Mermaid. */
export function inferRechartsFromRows(rows: Record<string, unknown>[]): RechartsPayload | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const first = rows[0];
  if (!first || typeof first !== "object") return null;

  const map = keyMap(first);

  // Single-cell aggregate (COUNT(*), SELECT value only, etc.) → one bar
  if (rows.length === 1) {
    const keys = Object.keys(first);
    if (keys.length === 1 && isNumeric(first[keys[0]])) {
      const k = keys[0];
      const label =
        /^(count|total|n|cnt)$/i.test(k) || /^count\(/i.test(k) || /^value$/i.test(k)
          ? "Total"
          : k.replace(/_/g, " ");
      return { variant: "bar", data: [{ name: label, value: Math.round(Number(first[k])) }] };
    }
  }

  const accountKey = pick(map, ["key"]);
  const accountVal = pick(map, ["value"]);
  if (accountKey && accountVal && accountKey !== accountVal) {
    const data = rows.map((r) => {
      const raw = String(r[accountKey] ?? "").trim();
      const name =
        raw === "github_repo_count" ? "GitHub repositories" : raw || "—";
      return { name, value: Math.round(Number(r[accountVal] ?? 0)) };
    });
    if (data.length > 0) return { variant: "bar", data };
  }

  const languageKey = pick(map, ["language", "lang"]);
  const pctKey = pick(map, ["percentage", "percent", "pct", "share", "value"]);
  if (languageKey && pctKey) {
    const data = rows
      .map((r) => ({
        name: String(r[languageKey] ?? "").trim(),
        value: Math.round(Number(r[pctKey] ?? 0)),
      }))
      .filter((d) => d.name && d.value >= 0);
    if (data.length > 0) return { variant: "pie", data };
  }

  const monthKey = pick(map, ["month", "period", "ym"]);
  const seriesKey = pick(map, [
    "activity",
    "commits",
    "total",
    "sum",
    "additions",
    "count",
    "value",
    "n",
    "cnt",
    "repos",
    "repos_created",
  ]);
  if (monthKey && seriesKey) {
    const data = rows.map((r) => ({
      month: String(r[monthKey] ?? "").trim(),
      value: Math.round(Number(r[seriesKey] ?? 0)),
    }));
    if (data.every((d) => d.month)) return { variant: "line", data };
  }

  const nameKey = pick(map, ["name", "repo", "label", "title", "language"]);
  const valueKey = pick(map, ["value", "activity", "total", "sum", "commits", "count", "percentage"]);
  if (nameKey && valueKey && nameKey !== valueKey) {
    const nums = rows.map((r) => r[valueKey]);
    if (nums.every(isNumeric)) {
      const data = rows.map((r) => ({
        name: String(r[nameKey] ?? "").trim() || "—",
        value: Math.round(Number(r[valueKey] ?? 0)),
      }));
      if (data.length > 0) return { variant: "bar", data };
    }
  }

  const keys = Object.keys(first);
  if (keys.length === 2) {
    const [a, b] = keys;
    const va = first[a];
    const vb = first[b];
    const strKey = typeof va === "string" || (typeof va === "number" && String(va).length < 20) ? a : b;
    const numKey = strKey === a ? b : a;
    if (isNumeric(first[numKey]) && !isNumeric(first[strKey])) {
      const data = rows.map((r) => ({
        name: String(r[strKey] ?? "").trim(),
        value: Math.round(Number(r[numKey] ?? 0)),
      }));
      if (data.length > 0) return { variant: "bar", data };
    }
  }

  return null;
}
