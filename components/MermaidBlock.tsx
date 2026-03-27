"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

type Props = { code: string; className?: string };

/**
 * Renders Mermaid source to SVG (client-only). Used for Visual SQL Agent and saved diagram artifacts.
 */
export function MermaidBlock({ code, className }: Props) {
  const reactId = useId();
  const safeId = reactId.replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSvg(null);
      setErr(null);
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "dark",
          fontFamily: "inherit",
        });
        const { svg: out } = await mermaid.render(`mmd-${safeId}-${Math.random().toString(36).slice(2, 9)}`, code);
        if (!cancelled) setSvg(out);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not render diagram");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, safeId]);

  if (err) {
    return (
      <div className={`rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive ${className ?? ""}`}>
        {err}
      </div>
    );
  }
  if (!svg) {
    return <p className={`text-xs text-muted-foreground ${className ?? ""}`}>Rendering diagram…</p>;
  }
  return (
    <div
      className={`overflow-x-auto rounded-md border border-border bg-muted/20 p-3 [&_svg]:max-w-full [&_svg]:h-auto ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
