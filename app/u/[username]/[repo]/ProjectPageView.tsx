"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTechBadgeClassName } from "@/lib/badgeColors";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { LanguageChart } from "@/components/LanguageChart";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { ArrowLeft, Github, ExternalLink, Globe } from "lucide-react";
import { SignedInNav } from "@/components/SignedInNav";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ScreenshotItem = { id: string; url: string; caption: string };
type DiagramItem = { id: string; url: string; description: string | null };

type Props = {
  portfolioSlug: string;
  userName: string;
  viewerUsername?: string | null;
  isOwner?: boolean;
  repoId: string;
  repo: {
    title: string;
    repoFullName: string;
    description: string;
    projectWebsiteUrl: string | null;
    showCommitsGraph: boolean;
    showLanguagesGraph: boolean;
    showScreenshots: boolean;
    showDiagram: boolean;
    stack: string[];
    commitData: { month: string; commits: number }[];
    languageData: { name: string; value: number }[];
    screenshots: ScreenshotItem[];
    diagrams: DiagramItem[];
  };
};

export function ProjectPageView({
  portfolioSlug,
  userName,
  viewerUsername,
  isOwner,
  repoId,
  repo,
}: Props) {
  const router = useRouter();
  const repoUrl = `https://github.com/${repo.repoFullName}`;

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(repo.description);
  const [projectWebsiteUrlDraft, setProjectWebsiteUrlDraft] = useState(repo.projectWebsiteUrl ?? "");
  const [showCommitsGraph, setShowCommitsGraph] = useState(repo.showCommitsGraph);
  const [showLanguagesGraph, setShowLanguagesGraph] = useState(repo.showLanguagesGraph);
  const [showScreenshots, setShowScreenshots] = useState(repo.showScreenshots);
  const [showDiagram, setShowDiagram] = useState(repo.showDiagram);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    repo.screenshots.forEach((s) => {
      o[s.id] = s.caption;
    });
    return o;
  });
  const [diagramDescriptionDrafts, setDiagramDescriptionDrafts] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    repo.diagrams.forEach((d) => {
      o[d.id] = d.description ?? "";
    });
    return o;
  });
  const [newScreenshotUrl, setNewScreenshotUrl] = useState("");
  const [newScreenshotCaption, setNewScreenshotCaption] = useState("");
  const [newScreenshotFile, setNewScreenshotFile] = useState<File | null>(null);
  const [newDiagramUrl, setNewDiagramUrl] = useState("");
  const [newDiagramDescription, setNewDiagramDescription] = useState("");
  const [newDiagramFile, setNewDiagramFile] = useState<File | null>(null);
  const [addingScreenshot, setAddingScreenshot] = useState(false);
  const [addingDiagram, setAddingDiagram] = useState(false);
  const [screenshotUploadError, setScreenshotUploadError] = useState<string | null>(null);
  const [diagramUploadError, setDiagramUploadError] = useState<string | null>(null);
  const [screenshotInputKey, setScreenshotInputKey] = useState(0);
  const [diagramInputKey, setDiagramInputKey] = useState(0);

  useEffect(() => {
    setDescriptionDraft(repo.description);
    setProjectWebsiteUrlDraft(repo.projectWebsiteUrl ?? "");
    setShowCommitsGraph(repo.showCommitsGraph);
    setShowLanguagesGraph(repo.showLanguagesGraph);
    setShowScreenshots(repo.showScreenshots);
    setShowDiagram(repo.showDiagram);
    setCaptionDrafts((prev) => {
      const next = { ...prev };
      repo.screenshots.forEach((s) => {
        next[s.id] = s.caption;
      });
      return next;
    });
    setDiagramDescriptionDrafts((prev) => {
      const next = { ...prev };
      repo.diagrams.forEach((d) => {
        next[d.id] = d.description ?? "";
      });
      return next;
    });
  }, [repo.description, repo.projectWebsiteUrl, repo.showCommitsGraph, repo.showLanguagesGraph, repo.showScreenshots, repo.showDiagram, repo.screenshots, repo.diagrams]);

  async function saveRepo() {
    setSaving(true);
    try {
      await fetch(`/api/portfolio/repos/${repoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customSummary: descriptionDraft,
          projectWebsiteUrl: projectWebsiteUrlDraft.trim() || null,
          showCommitsGraph,
          showLanguagesGraph,
          showScreenshots,
          showDiagram,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveScreenshotCaption(artifactId: string, caption: string) {
    await fetch(`/api/portfolio/repos/${repoId}/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { caption } }),
    });
    router.refresh();
  }

  async function deleteArtifact(artifactId: string) {
    await fetch(`/api/portfolio/repos/${repoId}/artifacts/${artifactId}`, { method: "DELETE" });
    router.refresh();
  }

  async function saveDiagramDescription(artifactId: string) {
    const description = diagramDescriptionDrafts[artifactId] ?? "";
    await fetch(`/api/portfolio/repos/${repoId}/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { description } }),
    });
    router.refresh();
  }

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/portfolio/repos/${repoId}/artifacts/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    return data.url;
  }

  async function createScreenshot() {
    setScreenshotUploadError(null);
    let url: string;
    if (newScreenshotFile) {
      try {
        url = await uploadFile(newScreenshotFile);
      } catch (err) {
        setScreenshotUploadError(err instanceof Error ? err.message : "Upload failed");
        return;
      }
    } else {
      url = newScreenshotUrl.trim();
      if (!url) return;
    }
    setAddingScreenshot(true);
    try {
      await fetch(`/api/portfolio/repos/${repoId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "screenshot",
          url,
          metadata: { caption: newScreenshotCaption.trim() || undefined },
        }),
      });
      router.refresh();
      setNewScreenshotUrl("");
      setNewScreenshotCaption("");
      setNewScreenshotFile(null);
      setScreenshotInputKey((k) => k + 1);
    } finally {
      setAddingScreenshot(false);
    }
  }

  async function createDiagram() {
    setDiagramUploadError(null);
    let url: string;
    if (newDiagramFile) {
      try {
        url = await uploadFile(newDiagramFile);
      } catch (err) {
        setDiagramUploadError(err instanceof Error ? err.message : "Upload failed");
        return;
      }
    } else {
      url = newDiagramUrl.trim();
      if (!url) return;
    }
    setAddingDiagram(true);
    try {
      await fetch(`/api/portfolio/repos/${repoId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "diagram",
          url,
          metadata: { description: newDiagramDescription.trim() || undefined },
        }),
      });
      router.refresh();
      setNewDiagramUrl("");
      setNewDiagramDescription("");
      setNewDiagramFile(null);
      setDiagramInputKey((k) => k + 1);
    } finally {
      setAddingDiagram(false);
    }
  }

  const canAddScreenshot = newScreenshotUrl.trim() || newScreenshotFile;
  const canAddDiagram = newDiagramUrl.trim() || newDiagramFile;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            Portify
          </Link>
          {viewerUsername ? (
            <SignedInNav username={viewerUsername} />
          ) : (
            <Link href="/api/auth/signin" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Link
            href={`/${portfolioSlug}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to {userName}&apos;s portfolio
          </Link>
          {isOwner && (
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? "Exit edit mode" : "Edit on page"}
            </Button>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{repo.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Github className="h-4 w-4" /> {repo.repoFullName}
              <ExternalLink className="h-3 w-3" />
            </a>
            {(repo.projectWebsiteUrl || (editMode && isOwner && projectWebsiteUrlDraft)) && (
              <a
                href={repo.projectWebsiteUrl || projectWebsiteUrlDraft || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Globe className="h-4 w-4" /> Project website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Embedded project website - load the site beside the repo link */}
        {(repo.projectWebsiteUrl || (editMode && isOwner && projectWebsiteUrlDraft)) && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3">Live site</h2>
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <iframe
                  title="Project website"
                  src={(repo.projectWebsiteUrl || projectWebsiteUrlDraft) || "about:blank"}
                  className="w-full h-[480px] border-0 bg-muted/20"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  referrerPolicy="no-referrer"
                />
              </CardContent>
            </Card>
            <p className="mt-2 text-xs text-muted-foreground">
              Some sites may block embedding.{" "}
              <a
                href={(repo.projectWebsiteUrl || projectWebsiteUrlDraft) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Open in new tab
              </a>
            </p>
          </section>
        )}

        {/* About */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">About</h2>
          {editMode && isOwner ? (
            <div className="space-y-2">
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                placeholder="Describe this project..."
              />
              <Button size="sm" onClick={saveRepo} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground leading-relaxed">{repo.description}</p>
          )}
        </section>

        {/* Project website (edit only when in edit mode) */}
        {editMode && isOwner && (
          <section className="mb-10">
            <Label className="text-xl font-semibold mb-3 block">Project website</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={projectWebsiteUrlDraft}
                onChange={(e) => setProjectWebsiteUrlDraft(e.target.value)}
                placeholder="https://myproject.com"
              />
              <Button size="sm" onClick={saveRepo} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </section>
        )}

        {repo.stack.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3">Tech stack</h2>
            <div className="flex flex-wrap gap-2">
              {repo.stack.map((s) => (
                <Badge key={s} variant="outline" className={`text-sm ${getTechBadgeClassName(s)}`}>
                  {s}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Contributions & languages */}
        {(showCommitsGraph || showLanguagesGraph || (editMode && isOwner)) && (
          <section className="mb-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-semibold">Contributions & languages</h2>
              {editMode && isOwner && (
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <Switch checked={showCommitsGraph} onCheckedChange={setShowCommitsGraph} />
                    Contributions graph
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={showLanguagesGraph} onCheckedChange={setShowLanguagesGraph} />
                    Languages graph
                  </label>
                  <Button size="sm" onClick={saveRepo} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {showCommitsGraph && repo.commitData.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <EvolutionGraph data={repo.commitData} />
                  </CardContent>
                </Card>
              )}
              {showLanguagesGraph && repo.languageData.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <LanguageChart data={repo.languageData} />
                  </CardContent>
                </Card>
              )}
            </div>
            {editMode && isOwner && !showCommitsGraph && !showLanguagesGraph && (
              <p className="text-sm text-muted-foreground">Turn on at least one graph above to show this section.</p>
            )}
          </section>
        )}

        {/* Screenshots */}
        {(showScreenshots || (editMode && isOwner)) && (
          <section className="mb-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-semibold">Screenshots</h2>
              {editMode && isOwner && (
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={showScreenshots} onCheckedChange={setShowScreenshots} />
                  Show section
                </label>
              )}
            </div>
            {showScreenshots && repo.screenshots.length > 0 ? (
              <div className="space-y-8">
                {repo.screenshots.map((s) => (
                  <Card key={s.id} className="relative">
                    {editMode && isOwner && (
                      <div className="absolute right-2 top-2 z-10 flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => saveScreenshotCaption(s.id, captionDrafts[s.id] ?? s.caption)}
                        >
                          Save caption
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => deleteArtifact(s.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    <CardContent className="p-0">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-t-lg overflow-hidden border-b border-border"
                      >
                        <img
                          src={s.url}
                          alt={s.caption}
                          className="w-full h-auto max-h-[480px] object-contain bg-muted/30"
                        />
                      </a>
                      <div className="px-4 py-3">
                        {editMode && isOwner ? (
                          <textarea
                            className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={captionDrafts[s.id] ?? s.caption}
                            onChange={(e) =>
                              setCaptionDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            placeholder="Caption..."
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">{s.caption}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : editMode && isOwner ? (
              <p className="text-sm text-muted-foreground">
                No screenshots yet. Add one below.
              </p>
            ) : null}
            {editMode && isOwner && (
              <Card className="mt-6 border-dashed">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-3">Add screenshot</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload an image from your computer or paste an image URL.
                  </p>
                  {screenshotUploadError && (
                    <p className="text-xs text-destructive mb-2">{screenshotUploadError}</p>
                  )}
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Upload from computer</Label>
                      <input
                        key={screenshotInputKey}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                        className="mt-1 block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setNewScreenshotFile(f ?? null);
                          if (f) setNewScreenshotUrl("");
                          setScreenshotUploadError(null);
                        }}
                      />
                      {newScreenshotFile && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {newScreenshotFile.name} ({(newScreenshotFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Or image URL</Label>
                      <input
                        type="url"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newScreenshotUrl}
                        onChange={(e) => {
                          setNewScreenshotUrl(e.target.value);
                          if (e.target.value) setNewScreenshotFile(null);
                        }}
                        placeholder="https://example.com/screenshot.png"
                      />
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newScreenshotCaption}
                      onChange={(e) => setNewScreenshotCaption(e.target.value)}
                      placeholder="Caption (optional)"
                    />
                    <Button size="sm" onClick={createScreenshot} disabled={addingScreenshot || !canAddScreenshot}>
                      {addingScreenshot ? "Adding…" : "Add screenshot"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Architecture diagrams */}
        {(showDiagram || (editMode && isOwner)) && (repo.diagrams.length > 0 || (editMode && isOwner)) && (
          <section className="mb-10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-semibold">Architecture</h2>
              {editMode && isOwner && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={showDiagram} onCheckedChange={setShowDiagram} />
                    Show section
                  </label>
                  <Button size="sm" onClick={saveRepo} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </div>
            {showDiagram && repo.diagrams.length > 0 && (
              <div className="space-y-8">
                {repo.diagrams.map((d) => (
                  <Card key={d.id} className="relative">
                    {editMode && isOwner && (
                      <div className="absolute right-2 top-2 z-10 flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => saveDiagramDescription(d.id)}
                        >
                          Save description
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => deleteArtifact(d.id)}
                        >
                          Remove diagram
                        </Button>
                      </div>
                    )}
                    <CardContent className="pt-6">
                      <ArchitectureDiagram url={d.url} />
                    </CardContent>
                    <div className="px-6 pb-4">
                      {editMode && isOwner ? (
                        <textarea
                          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={diagramDescriptionDrafts[d.id] ?? d.description ?? ""}
                          onChange={(e) =>
                            setDiagramDescriptionDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          placeholder="Describe this diagram..."
                        />
                      ) : (
                        d.description && (
                          <p className="text-sm text-muted-foreground">{d.description}</p>
                        )
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {editMode && isOwner && (
              <Card className="mt-6 border-dashed">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium mb-3">Add diagram</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Upload an image from your computer or paste a diagram image URL.
                  </p>
                  {diagramUploadError && (
                    <p className="text-xs text-destructive mb-2">{diagramUploadError}</p>
                  )}
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Upload from computer</Label>
                      <input
                        key={diagramInputKey}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                        className="mt-1 block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setNewDiagramFile(f ?? null);
                          if (f) setNewDiagramUrl("");
                          setDiagramUploadError(null);
                        }}
                      />
                      {newDiagramFile && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {newDiagramFile.name} ({(newDiagramFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Or diagram image URL</Label>
                      <input
                        type="url"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newDiagramUrl}
                        onChange={(e) => {
                          setNewDiagramUrl(e.target.value);
                          if (e.target.value) setNewDiagramFile(null);
                        }}
                        placeholder="https://example.com/diagram.png"
                      />
                    </div>
                    <input
                      type="text"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newDiagramDescription}
                      onChange={(e) => setNewDiagramDescription(e.target.value)}
                      placeholder="Description (optional)"
                    />
                    <Button size="sm" onClick={createDiagram} disabled={addingDiagram || !canAddDiagram}>
                      {addingDiagram ? "Adding…" : "Add diagram"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {editMode && isOwner && repo.diagrams.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No diagrams yet. Add one above or they may be generated when you generate the project.
              </p>
            )}
          </section>
        )}

        <div className="pt-6 border-t border-border flex flex-wrap gap-4">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            View repository on GitHub <ExternalLink className="h-4 w-4" />
          </a>
          {(repo.projectWebsiteUrl || (editMode && isOwner && projectWebsiteUrlDraft)) && (
            <a
              href={(repo.projectWebsiteUrl || projectWebsiteUrlDraft) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Globe className="h-4 w-4" /> Project website
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
