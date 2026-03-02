"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const messages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration (GitHub). Check GITHUB_ID and GITHUB_SECRET.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The sign-in link was already used or expired.",
    OAuthAccountNotLinked: "This email is already linked to another account. Try signing in with that account, or clear the database and try again.",
    Default: "An error occurred during sign-in.",
  };

  const message = error ? messages[error] ?? messages.Default : messages.Default;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Sign-in error</h1>
        <p className="text-muted-foreground text-sm mb-4">{message}</p>
        {error && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">Error code: {error}</p>
        )}
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
