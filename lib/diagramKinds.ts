/**
 * Diagram kinds for portfolio repo artifacts (type: "diagram").
 * Stored in artifact metadata as diagramKind.
 */
export const DIAGRAM_KINDS = [
  { value: "architecture", label: "Architecture diagram" },
  { value: "data-flow", label: "Data flow diagram" },
  { value: "api-routes", label: "API route map" },
  { value: "db-schema", label: "Database schema diagram" },
  { value: "dependency-graph", label: "Dependency graph" },
  { value: "sequence", label: "Sequence diagram" },
] as const;

export type DiagramKindValue = (typeof DIAGRAM_KINDS)[number]["value"];

const LABEL_BY_KIND: Record<string, string> = Object.fromEntries(
  DIAGRAM_KINDS.map((k) => [k.value, k.label])
);

export function getDiagramKindLabel(kind: string | undefined | null): string {
  if (!kind) return "Diagram";
  return LABEL_BY_KIND[kind] ?? kind;
}
