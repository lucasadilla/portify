import Link from "next/link";

export default function SignOutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight mb-2">You’re signed out</h1>
          <p className="text-muted-foreground text-sm mb-6">
            You have been signed out of your account. Come back anytime to continue building your portfolio.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to home
          </a>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/auth/signin" className="hover:text-foreground underline underline-offset-4">
            Sign in again
          </Link>
        </p>
      </div>
    </div>
  );
}
