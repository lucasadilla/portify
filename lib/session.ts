import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextAuthUsesSecureCookies } from "@/lib/nextAuthCookies";

export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * GitHub OAuth access token for the current session. Prefer the value embedded in the JWT
 * (set on sign-in) so API routes work even when the Prisma Account row has no access_token.
 *
 * Pass the incoming `Request` from Route Handlers when available — reads the session cookie
 * reliably in local dev (App Router + getToken cookie name must match `useSecureCookies`).
 */
export async function getAccessToken(request?: Request): Promise<string | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  const secureCookie = nextAuthUsesSecureCookies();

  if (secret) {
    try {
      // getToken expects a Node-style req with headers.cookie — casting Fetch Request
      // often fails silently; always pass an explicit cookie header.
      let cookieHeader = "";
      if (request) {
        cookieHeader = request.headers.get("cookie") ?? "";
      }
      if (!cookieHeader) {
        const h = await headers();
        cookieHeader = h.get("cookie") ?? "";
        if (!cookieHeader) {
          const store = await cookies();
          cookieHeader = store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
        }
      }

      let jwt =
        cookieHeader.length > 0
          ? await getToken({
              req: { headers: { cookie: cookieHeader } } as Parameters<typeof getToken>[0]["req"],
              secret,
              secureCookie,
            })
          : null;

      const fromJwt = jwt?.githubAccessToken;
      if (typeof fromJwt === "string" && fromJwt.length > 0) return fromJwt;
    } catch {
      // headers/cookies unavailable outside a request
    }
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  });
  return account?.access_token ?? null;
}

export async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
  });
  return account?.access_token ?? null;
}
