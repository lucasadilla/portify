import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GitHubSignInButton } from "./GitHubSignInButton";

const ERROR_MESSAGES: Record<string, string> = {
  github:
    "A previous sign-in didn’t complete. Try again below — if it keeps failing, check the callback URL in your GitHub OAuth App (http://localhost:3000/api/auth/callback/github) and restart the dev server.",
  OAuthCallback:
    "Sign-in was interrupted (cookie or state lost). Try again in the same browser with cookies enabled, or in a private window.",
  OAuthSignin: "Could not start GitHub sign-in. Check your GitHub OAuth App Client ID and Secret.",
  Configuration: "Server auth is misconfigured. Check .env has GITHUB_ID, GITHUB_SECRET, NEXTAUTH_URL, and NEXTAUTH_SECRET.",
  AccessDenied: "You don’t have permission to sign in.",
  Default: "Something went wrong during sign-in. Try again. Check the terminal for [NextAuth] debug output.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { callbackUrl = "/generate", error } = await searchParams;
  if (session) redirect(callbackUrl);

  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default : null;
  const envOk =
    !!process.env.GITHUB_ID?.trim() &&
    !!process.env.GITHUB_SECRET?.trim() &&
    !!process.env.NEXTAUTH_SECRET?.trim();
  const showError = errorMessage && !(error === "github" && envOk);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <span className="text-lg font-semibold text-foreground">Portify</span>
          <span aria-hidden>←</span>
          <span>Back to home</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-xl">
          {showError && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-1">
              <p>{errorMessage}</p>
              {process.env.NODE_ENV === "development" && error && (
                <p className="text-xs opacity-80 pt-1">Error code: <code className="font-mono">{error}</code></p>
              )}
            </div>
          )}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground text-sm">
              Sign in with your GitHub account to build and manage your portfolio.
            </p>
          </div>

          <GitHubSignInButton callbackUrl={callbackUrl} />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By signing in, you allow Portify to read your public profile and repositories to build your portfolio.
          </p>
        </div>

        <p className="mt-8 text-center">
          <Link href="/demo" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
            View demo portfolio without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
