/**
 * Must match how NextAuth names session cookies (see lib/auth.ts cookies.useSecureCookies).
 * In development we always use non-secure cookies so http://localhost works even if
 * NEXTAUTH_URL was copied from production.
 */
export function nextAuthUsesSecureCookies(): boolean {
  return (
    process.env.NODE_ENV === "production" && (process.env.NEXTAUTH_URL?.startsWith("https://") ?? false)
  );
}
