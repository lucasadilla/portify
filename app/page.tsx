import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignedInNav } from "@/components/SignedInNav";

const SIGNIN_URL = "/api/auth/signin/github?callbackUrl=/dashboard";

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
              <Link href="/u/demo" className="text-muted-foreground hover:text-foreground text-sm">
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          From Commits to Career
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-8">
          Portify turns your GitHub activity into a live, structured portfolio — AI summaries,
          tech stack detection, screenshots, and evolution graphs.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Dashboard
              </Link>
              {session.user?.username && (
                <Link
                  href={`/u/${session.user.username.replace(/\s+/g, "-").toLowerCase()}`}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-base font-medium hover:bg-accent"
                  target="_blank"
                >
                  View my portfolio
                </Link>
              )}
            </>
          ) : (
            <>
              <a
                href={SIGNIN_URL}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90"
              >
                Get started with GitHub
              </a>
              <Link
                href="/u/demo"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-base font-medium hover:bg-accent"
              >
                View sample portfolio
              </Link>
            </>
          )}
        </div>

        <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl text-left">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-2">AI summaries</h3>
            <p className="text-sm text-muted-foreground">
              One-paragraph summaries and tech stack detection for every repo.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-2">Screenshots & diagrams</h3>
            <p className="text-sm text-muted-foreground">
              Auto-captured screenshots and Mermaid architecture diagrams.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-2">Evolution graph</h3>
            <p className="text-sm text-muted-foreground">
              Commits over time and language distribution from your GitHub history.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
