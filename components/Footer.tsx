import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="font-semibold text-sm tracking-tight text-foreground hover:opacity-90">
            Portify
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/demo" className="hover:text-foreground transition-colors">
              Demo
            </Link>
            <Link href="/auth/signin" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mt-4 text-center sm:text-left text-xs text-muted-foreground">
          © {currentYear} Portify. From commits to career.
        </p>
      </div>
    </footer>
  );
}
