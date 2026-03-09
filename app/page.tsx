import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignedInNav } from "@/components/SignedInNav";
import { EvolutionGraph, type EvolutionDataPoint } from "@/components/EvolutionGraph";
import { LanguageChart, type LanguageSlice } from "@/components/LanguageChart";

const SIGNIN_URL = "/api/auth/signin/github?callbackUrl=/generate";

const HERO_EVOLUTION: EvolutionDataPoint[] = [
  { month: "2024-01", commits: 6 },
  { month: "2024-02", commits: 12 },
  { month: "2024-03", commits: 4 },
  { month: "2024-04", commits: 18 },
  { month: "2024-05", commits: 10 },
];

const HERO_LANGUAGES: LanguageSlice[] = [
  { name: "TypeScript", value: 48 },
  { name: "Python", value: 27 },
  { name: "Other", value: 25 },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            Portify
          </Link>
          {session ? (
            <SignedInNav username={session.user?.username ?? session.user?.name ?? null} />
          ) : (
            <nav className="flex items-center gap-4">
              <Link href="/demo" className="text-muted-foreground hover:text-foreground text-sm">
                View demo
              </Link>
              <a
                href={SIGNIN_URL}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign in with GitHub
              </a>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background to-background/95">
          <div className="pointer-events-none absolute inset-x-0 -top-40 flex justify-center blur-3xl">
            <div className="h-64 w-[40rem] bg-gradient-to-r from-sky-500/30 via-emerald-500/25 to-violet-500/30 opacity-70" />
          </div>
          <div className="container mx-auto px-4 py-16 md:py-24 relative">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200 mb-5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live portfolios from real GitHub activity
                </div>
                <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-4">
                  From Commits to Career
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-6">
                  Portify reads your GitHub history and turns it into a narrative: projects, tech stack, evolution graphs, and a timeline you&apos;d actually share in a job application.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-5">
                  {session ? (
                    <>
                      <Link
                        href="/generate"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm md:text-base font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Generate my portfolio
                      </Link>
                      {session.user?.username && (
                        <Link
                          href={`/${session.user.username.replace(/\s+/g, "-").toLowerCase()}`}
                          className="inline-flex items-center justify-center rounded-md border border-border/70 bg-background/80 px-6 py-3 text-sm md:text-base font-medium text-muted-foreground hover:bg-accent/70"
                          target="_blank"
                        >
                          View my live page
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      <a
                        href={SIGNIN_URL}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm md:text-base font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Sign in with GitHub
                      </a>
                      <Link
                        href="/demo"
                        className="inline-flex items-center justify-center rounded-md border border-border/70 bg-background/80 px-6 py-3 text-sm md:text-base font-medium text-muted-foreground hover:bg-accent/70"
                      >
                        Explore a sample portfolio
                      </Link>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Works with any public GitHub profile
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    No writing prompts or manual case studies
                  </div>
                </div>
              </div>

              {/* Hero preview card */}
              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/40 via-sky-500/40 to-violet-500/40 opacity-60 blur-xl" aria-hidden />
                <div className="relative rounded-3xl border border-border/60 bg-card/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm p-5 md:p-6">
                  {/* Soft static gradient background, echoing portfolio background choices */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                    <div className="absolute -top-20 -left-24 h-40 w-40 rounded-full bg-[radial-gradient(circle,theme(colors.violet.500),transparent_65%)] opacity-40 blur-3xl" />
                    <div className="absolute -bottom-16 -right-24 h-44 w-44 rounded-full bg-[radial-gradient(circle,theme(colors.emerald.500),transparent_65%)] opacity-40 blur-3xl" />
                    <div className="absolute inset-x-10 top-6 h-20 rounded-full bg-[radial-gradient(circle,theme(colors.sky.500),transparent_70%)] opacity-25 blur-2xl" />
                  </div>
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                          PORTFOLIO PREVIEW
                        </p>
                        <h2 className="text-base md:text-lg font-semibold truncate">
                          github.com/you/portify
                        </h2>
                      </div>
                      <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-300 border border-emerald-500/40">
                        Live from GitHub
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-3 md:p-4 space-y-3">
                      {/* Mini demo header with avatar */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative h-8 w-8 rounded-full border border-border/70 bg-background overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/70 via-sky-500/70 to-violet-500/70" />
                            <div className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_30%_20%,#ffffffcc,transparent_55%),radial-gradient(circle_at_80%_80%,#020617,transparent_65%)]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">yourname.dev</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              TypeScript · Next.js · Open Source
                            </p>
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Auto-updates as you push
                        </div>
                      </div>

                      {/* Contributions & languages + mini journey, laid out like a small dashboard */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 mb-1">
                        <span className="font-medium text-foreground/90">Contributions, languages & journey</span>
                        <span>Demo view</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border/70 bg-background/90 p-2.5">
                          <EvolutionGraph data={HERO_EVOLUTION} className="space-y-1" />
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="rounded-xl border border-border/70 bg-background/90 p-2.5">
                            <LanguageChart data={HERO_LANGUAGES} className="space-y-1" />
                          </div>
                          {/* Mini developer journey timeline, echoing the portfolio view */}
                          <div className="rounded-xl border border-border/70 bg-background/90 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="font-medium text-foreground/90">Developer journey</span>
                              <span>Key moments</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-start gap-2 text-[10px]">
                                <div className="flex flex-col items-center pt-0.5">
                                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                  <span className="mt-0.5 h-5 w-px bg-border/70" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">Joined GitHub</p>
                                  <p className="text-[9px] text-muted-foreground/90">2018 • @yourname</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 text-[10px]">
                                <div className="flex flex-col items-center pt-0.5">
                                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                                  <span className="mt-0.5 h-5 w-px bg-border/70" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">Shipped Portify</p>
                                  <p className="text-[9px] text-muted-foreground/90">TypeScript · Next.js · Postgres</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 text-[10px]">
                                <div className="flex flex-col items-center pt-0.5">
                                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">First OSS PR merged</p>
                                  <p className="text-[9px] text-muted-foreground/90">Shows up on your public timeline</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="container mx-auto px-4 py-10 md:py-14">
          <div className="max-w-3xl mb-8">
            <h2 className="text-xl md:text-2xl font-semibold mb-2">What Portify gives you, beyond a link tree</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Instead of sending people to raw GitHub profiles or Notion docs, you get a single URL that shows your work, how you build, and how it&apos;s evolved.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="rounded-xl border border-border bg-card/95 p-5 space-y-2">
              <p className="text-xs font-medium text-emerald-400 uppercase tracking-[0.16em]">
                Project stories
              </p>
              <h3 className="font-semibold">Readable repo summaries</h3>
              <p className="text-sm text-muted-foreground">
                Each project gets a human-length description and tech stack badges, so people can actually skim what you&apos;ve built.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/95 p-5 space-y-2">
              <p className="text-xs font-medium text-sky-400 uppercase tracking-[0.16em]">
                Visual context
              </p>
              <h3 className="font-semibold">Screenshots & diagrams</h3>
              <p className="text-sm text-muted-foreground">
                Attach UI screenshots and Mermaid diagrams so your portfolio feels like a product, not just a list.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/95 p-5 space-y-2">
              <p className="text-xs font-medium text-violet-400 uppercase tracking-[0.16em]">
                Signal over noise
              </p>
              <h3 className="font-semibold">Evolution & languages</h3>
              <p className="text-sm text-muted-foreground">
                See how your commits, languages, and key repos change over time, pulled straight from GitHub.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
