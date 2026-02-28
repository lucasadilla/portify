"use client";

interface ArchitectureDiagramProps {
  url: string;
}

export function ArchitectureDiagram({ url }: ArchitectureDiagramProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Architecture</p>
      <div className="rounded-md border border-border overflow-hidden bg-card">
        <img
          src={url}
          alt="Architecture diagram"
          className="w-full h-auto"
        />
      </div>
    </div>
  );
}
