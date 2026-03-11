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
              <div className="relative group">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/40 via-sky-500/40 to-violet-500/40 opacity-50 group-hover:opacity-70 blur-xl transition-opacity duration-300" aria-hidden />
                <div className="relative rounded-3xl border border-border/60 bg-card/95 shadow-xl shadow-black/20 backdrop-blur-sm overflow-hidden">
                  {/* Soft static gradient background */}
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-20 -left-24 h-40 w-40 rounded-full bg-[radial-gradient(circle,theme(colors.violet.500),transparent_65%)] opacity-30 blur-3xl" />
                    <div className="absolute -bottom-16 -right-24 h-44 w-44 rounded-full bg-[radial-gradient(circle,theme(colors.emerald.500),transparent_65%)] opacity-30 blur-3xl" />
                    <div className="absolute inset-x-10 top-6 h-20 rounded-full bg-[radial-gradient(circle,theme(colors.sky.500),transparent_70%)] opacity-20 blur-2xl" />
                  </div>
                  <div className="relative p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/90 font-medium mb-1.5">
                          Your portfolio
                        </p>
                        <h2 className="text-base md:text-lg font-semibold truncate" title="portify.com/your-name">
                          portify.com/your-name
                        </h2>
                      </div>
                      <div className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                        Live from GitHub
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/90 shadow-inner p-3.5 md:p-4 space-y-3.5">
                      {/* Mini demo header with avatar */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative h-9 w-9 rounded-full border border-border/60 bg-background overflow-hidden shrink-0 ring-2 ring-background/80">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/70 via-sky-500/70 to-violet-500/70" />
                            <div className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_30%_20%,#ffffffcc,transparent_55%),radial-gradient(circle_at_80%_80%,#020617,transparent_65%)]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-foreground/95">your-name</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              TypeScript · Next.js · Open Source
                            </p>
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-[10px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Auto-updates as you push
                        </div>
                      </div>

                      {/* Contributions & languages + mini journey */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                        <span className="font-medium text-foreground/80">Contributions, languages & journey</span>
                        <span className="text-muted-foreground/80">Demo</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-border/60 bg-background/95 p-2.5 shadow-sm">
                          <EvolutionGraph data={HERO_EVOLUTION} className="space-y-1" />
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="rounded-xl border border-border/60 bg-background/95 p-2.5 shadow-sm">
                            <LanguageChart data={HERO_LANGUAGES} className="space-y-1" />
                          </div>
                          {/* Mini developer journey timeline */}
                          <div className="rounded-xl border border-border/60 bg-background/95 p-2.5 space-y-1.5 shadow-sm">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="font-medium text-foreground/80">Developer journey</span>
                              <span className="text-muted-foreground/80">Key moments</span>
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

        {/* How it works */}
        <section className="container mx-auto px-4 pt-10 md:pt-14 pb-8 md:pb-10">
          <div className="max-w-3xl mb-4 md:mb-6">
            <h2 className="text-xl md:text-2xl font-semibold mb-2">How Portify works</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Three quick steps from raw GitHub activity to a portfolio link you&apos;re not embarrassed to share.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/95">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute inset-x-10 -top-24 h-40 rounded-full bg-[radial-gradient(circle,theme(colors.emerald.500),transparent_65%)] blur-3xl" />
              <div className="absolute inset-x-24 bottom-0 h-40 rounded-full bg-[radial-gradient(circle,theme(colors.violet.500),transparent_65%)] blur-3xl" />
            </div>
            <div className="relative grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-5 md:p-6 flex flex-col gap-3">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-[12px] font-semibold text-emerald-300 border border-emerald-500/40">
                    1
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/80">
                    Connect GitHub
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1.5">Pick the repos that represent you</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Sign in with GitHub and choose a handful of projects. Portify reads commits, languages, and metadata.
                  </p>
                </div>
              </div>
              <div className="p-5 md:p-6 flex flex-col gap-3">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-[12px] font-semibold text-sky-300 border border-sky-500/40">
                    2
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-sky-300/80">
                    Generate
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1.5">Portify builds the narrative for you</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    We write repo summaries, detect stacks, build graphs, and stitch it into a single page that feels like a personal landing, not a CV. With the ability to add your own edits to the portfolio.
                  </p>
                </div>
              </div>
              <div className="p-5 md:p-6 flex flex-col gap-3">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-[12px] font-semibold text-violet-300 border border-violet-500/40">
                    3
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-violet-300/80">
                    Share &amp; forget
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1.5">Share one URL that stays fresh</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    You get a clean slug (like <span className="font-mono">/yourname</span>) you can drop into applications, DMs, and bios while Portify quietly keeps it in sync.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="container mx-auto px-4 pb-12 md:pb-16">
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
