"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EditorPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/portfolio/repos")
      .then((r) => r.json())
      .then((data) => {
        if (data.portfolio?.slug) {
          router.replace(`/${data.portfolio.slug}`);
        }
      });
  }, [router]);

  return (
    <div className="max-w-2xl space-y-8 p-8">
      <p className="text-muted-foreground">
        Redirecting to your portfolio… If nothing happens,{" "}
        <Link href="/generate" className="font-medium text-foreground underline underline-offset-2">
          generate your portfolio
        </Link>{" "}
        first.
      </p>
    </div>
  );
}
