"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTechBadgeClassName } from "@/lib/badgeColors";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { ScreenshotGallery } from "./ScreenshotGallery";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

interface RepoCardRepo {
  id: string;
  repoFullName: string;
  customTitle: string | null;
  customSummary: string | null;
  detectedStackJson: string | null;
  status: string;
  artifacts: { id: string; type: string; url: string }[];
}

interface RepoCardProps {
  repo: RepoCardRepo;
  summary?: string | null;
  stack?: string[] | null;
  onGenerate: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
  jobStatus?: { status: string; progress: number; stepLabel?: string; error?: string };
  failureReason?: string;
}

export function RepoCard({
  repo,
  summary,
  stack,
  onGenerate,
  onRemove,
  jobStatus,
  failureReason,
}: RepoCardProps) {
  const [loading, setLoading] = useState(false);
  const displaySummary = repo.customSummary ?? summary ?? "No description yet.";
  const displayTitle = repo.customTitle ?? repo.repoFullName.split("/")[1];
  const stackList = stack ?? (repo.detectedStackJson ? JSON.parse(repo.detectedStackJson) : []) as string[];
  const screenshots = repo.artifacts?.filter((a) => a.type === "screenshot") ?? [];
  const diagram = repo.artifacts?.find((a) => a.type === "diagram");
  const hasScreenshots = screenshots.length > 0;
  const isNew = repo.status === "DONE" && !hasScreenshots && !jobStatus;
  const isProcessing = repo.status === "PROCESSING" || jobStatus?.status === "ACTIVE" || jobStatus?.status === "QUEUED";
  const badgeVariant =
    isNew
      ? "secondary"
      : repo.status === "DONE"
      ? "success"
      : repo.status === "FAILED"
      ? "destructive"
      : repo.status === "PROCESSING"
      ? "warning"
      : "secondary";
  const badgeLabel = isNew ? "NEW" : repo.status;

  async function handleGenerate() {
    setLoading(true);
    try {
      await onGenerate(repo.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{displayTitle}</h3>
          <p className="text-sm text-muted-foreground">{repo.repoFullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={badgeVariant}
          >
            {badgeLabel}
          </Badge>
          <Button variant="ghost" size="icon" asChild>
            <a
              href={`https://github.com/${repo.repoFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on GitHub"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(repo.id)}
            aria-label="Remove repo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(repo.status === "FAILED" && (failureReason || jobStatus?.error)) && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {failureReason ?? jobStatus?.error}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{displaySummary}</p>
        {stackList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stackList.map((s) => (
              <Badge key={s} variant="outline" className={`text-xs ${getTechBadgeClassName(s)}`}>
                {s}
              </Badge>
            ))}
          </div>
        )}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={jobStatus?.progress ?? 0} />
            <p className="text-xs text-muted-foreground">{jobStatus?.stepLabel ?? "Generating portfolio assets…"}</p>
          </div>
        )}
        {screenshots.length > 0 && <ScreenshotGallery urls={screenshots.map((s) => s.url)} />}
        {diagram && <ArchitectureDiagram url={diagram.url} />}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleGenerate}
          disabled={loading || isProcessing}
        >
          {loading || isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isProcessing ? "Processing…" : isNew ? "Generate" : "Regenerate"}
        </Button>
      </CardFooter>
    </Card>
  );
}
