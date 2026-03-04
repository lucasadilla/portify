"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SignedInNavProps {
  username?: string | null;
}

export function SignedInNav({ username }: SignedInNavProps) {
  const slug =
    username && username.trim().length > 0
      ? username.replace(/\s+/g, "-").toLowerCase()
      : null;

  return (
    <nav className="flex items-center gap-4">
      <Link href="/dashboard" className="text-muted-foreground hover:text-foreground text-sm">
        Dashboard
      </Link>
      <Link href="/editor" className="text-muted-foreground hover:text-foreground text-sm">
        Editor
      </Link>
      {slug && (
        <Link
          href={`/u/${slug}`}
          target="_blank"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          View portfolio
        </Link>
      )}
      <form action="/api/auth/signout" method="POST">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </nav>
  );
}

