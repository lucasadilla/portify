"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { LanguageChart } from "@/components/LanguageChart";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { ArrowLeft, Github, ExternalLink } from "lucide-react";

type Props = {
  portfolioSlug: string;
  userName: string;
  repo: {
    title: string;
    repoFullName: string;
    description: string;
    stack: string[];
    commitData: { month: string; commits: number }[];
    languageData: { name: string; value: number }[];
    screenshots: { url: string; caption: string }[];
    diagramUrl: string | null;
  };
};

export function ProjectPageView({ portfolioSlug, userName, repo }: Props) {
  const repoUrl = `https://github.com/${repo.repoFullName}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            Portify
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/u/${portfolioSlug}`}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Back to {userName}&apos;s portfolio
            </Link>
            <Link href="/api/auth/signin" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{repo.title}</h1>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
          >
            <Github className="h-4 w-4" /> {repo.repoFullName}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">About</h2>
          <p className="text-muted-foreground leading-relaxed">{repo.description}</p>
        </section>

        {repo.stack.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3">Tech stack</h2>
            <div className="flex flex-wrap gap-2">
              {repo.stack.map((s) => (
                <Badge key={s} variant="secondary" className="text-sm">
                  {s}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {repo.commitData.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <EvolutionGraph data={repo.commitData} />
              </CardContent>
            </Card>
          )}
          {repo.languageData.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <LanguageChart data={repo.languageData} />
              </CardContent>
            </Card>
          )}
        </section>

        {repo.screenshots.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Screenshots</h2>
            <div className="space-y-8">
              {repo.screenshots.map((s, i) => (
                <Card key={i}>
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
                      <p className="text-sm text-muted-foreground">{s.caption}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {repo.diagramUrl && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Architecture</h2>
            <Card>
              <CardContent className="pt-6">
                <ArchitectureDiagram url={repo.diagramUrl} />
              </CardContent>
            </Card>
          </section>
        )}

        <div className="pt-6 border-t border-border">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            View repository on GitHub <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </main>
    </div>
  );
}
