"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface SignedInNavProps {
  username?: string | null;
}

export function SignedInNav({ username }: SignedInNavProps) {
  const slug =
    username && username.trim().length > 0
      ? username.replace(/\s+/g, "-").toLowerCase()
      : null;

  const handleSignOut = () => {
    signOut({ redirect: false }).then(() => {
      window.location.href = "/";
    });
  };

  return (
    <nav className="flex items-center gap-4">
      <Link href="/generate" className="text-muted-foreground hover:text-foreground text-sm">
        Generate
      </Link>
      <Link href="/settings" className="text-muted-foreground hover:text-foreground text-sm">
        Settings
      </Link>
      {slug && (
        <Link
          href={`/${slug}`}
          target="_blank"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          View portfolio
        </Link>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </nav>
  );
}

