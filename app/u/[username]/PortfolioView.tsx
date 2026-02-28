"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { LanguageChart } from "@/components/LanguageChart";
import { Mail, Globe, Linkedin, Github } from "lucide-react";

type RepoArtifact = { id: string; type: string; url: string };

type Repo = {
  id: string;
  repoFullName: string;
  customTitle: string | null;
  customSummary: string | null;
  detectedStackJson: string | null;
  artifacts: RepoArtifact[];
};

type Props = {
  portfolio: {
    slug: string;
    bio: string | null;
    theme: string;
    socials: Record<string, string>;
    user: { name: string | null; image: string | null; email: string | null };
    repos: Repo[];
  };
};

export function PortfolioView({ portfolio }: Props) {
  const { user, repos, bio, socials } = portfolio;
  const screenshotsByRepo = repos.map((r) => r.artifacts.filter((a) => a.type === "screenshot").map((a) => a.url));
  const diagramByRepo = repos.map((r) => r.artifacts.find((a) => a.type === "diagram"));

  // Mock evolution data - in real app would come from API
  const evolutionData = [
    { month: "2024-01", commits: 12 },
    { month: "2024-02", commits: 19 },
    { month: "2024-03", commits: 8 },
    { month: "2024-04", commits: 24 },
    { month: "2024-05", commits: 15 },
  ];
  const languageData = [
    { name: "TypeScript", value: 40 },
    { name: "JavaScript", value: 25 },
    { name: "CSS", value: 20 },
    { name: "Other", value: 15 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            Portify
          </Link>
          <Link href="/api/auth/signin" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <section className="flex flex-col md:flex-row gap-8 items-start mb-12">
          {user.image && (
            <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
              <Image src={user.image} alt={user.name ?? ""} fill className="object-cover" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
            {bio && <p className="text-muted-foreground mb-4">{bio}</p>}
            <div className="flex flex-wrap gap-4 text-sm">
              {socials.email && (
                <a href={`mailto:${socials.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Mail className="h-4 w-4" /> {socials.email}
                </a>
              )}
              {socials.website && (
                <a href={socials.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" /> Website
                </a>
              )}
              {socials.linkedin && (
                <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <EvolutionGraph data={evolutionData} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <LanguageChart data={languageData} />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-8">
          <h2 className="text-2xl font-semibold">Projects</h2>
          {repos.map((repo, i) => {
            const title = repo.customTitle ?? repo.repoFullName.split("/")[1];
            const summary = repo.customSummary ?? "No description.";
            const stack = repo.detectedStackJson ? (JSON.parse(repo.detectedStackJson) as string[]) : [];
            const screenshots = repo.artifacts.filter((a) => a.type === "screenshot").map((a) => a.url);
            const diagram = repo.artifacts.find((a) => a.type === "diagram");
            return (
              <Card key={repo.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <a
                      href={`https://github.com/${repo.repoFullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Github className="h-4 w-4" /> {repo.repoFullName}
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{summary}</p>
                  {stack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {stack.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {screenshots.length > 0 && <ScreenshotGallery urls={screenshots} />}
                  {diagram && <ArchitectureDiagram url={diagram.url} />}
                </CardContent>
              </Card>
            );
          })}
        </section>
      </main>
    </div>
  );
}
