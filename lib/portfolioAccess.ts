import type { Session } from "next-auth";

/**
 * Matches app/[slug]/page.tsx isOwner logic so API routes agree with who can edit in the UI.
 * In development, username match allows access when JWT user id drifts from Prisma user id.
 */
export function sessionCanEditPortfolio(
  session: Session | null,
  portfolio: { userId: string; user: { username: string | null } }
): boolean {
  if (!session?.user?.id) return false;
  if (session.user.id === portfolio.userId) return true;
  if (process.env.NODE_ENV !== "production") {
    const v = (session.user.username ?? session.user.name ?? "").trim().toLowerCase();
    const u = (portfolio.user.username ?? "").trim().toLowerCase();
    if (v && u && v === u) return true;
  }
  return false;
}
