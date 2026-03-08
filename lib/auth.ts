import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db";

// Trim quotes that sometimes end up in .env values
const githubId = process.env.GITHUB_ID?.replace(/^["']|["']$/g, "").trim();
const githubSecret = process.env.GITHUB_SECRET?.replace(/^["']|["']$/g, "").trim();

// Temporarily disable adapter to test if OAuth flow works; re-enable after sign-in succeeds
const useAdapter = process.env.NEXTAUTH_SKIP_ADAPTER !== "true";

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  ...(useAdapter ? { adapter: PrismaAdapter(prisma) } : {}),
  allowDangerousEmailAccountLinking: true,
  providers: [
    GitHubProvider({
      clientId: githubId ?? "",
      clientSecret: githubSecret ?? "",
      authorization: { params: { scope: "read:user user:email repo" } },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email ?? null,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin !== baseUrl) return `${baseUrl}/generate`;
      if (url === baseUrl || url === `${baseUrl}/`) return `${baseUrl}/generate`;
      return url;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        token.uid = user.id;
        token.username = (user as { username?: string }).username ?? (user as { name?: string }).name ?? (profile as { login?: string })?.login ?? (token.name as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? (token.sub as string);
        session.user.username = (token.username as string) ?? session.user.name ?? "";
      }
      return session;
    },
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth-error",
  },
  events: useAdapter
    ? {
        async signIn({ user, account, profile }) {
          if (!user?.id || account?.provider !== "github") return;
          const providerAccountId = account.providerAccountId as string;
          const login = profile && "login" in profile ? (profile as { login: string }).login : user.name ?? null;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              githubId: providerAccountId,
              username: login,
              avatarUrl: user.image ?? undefined,
            },
          }).catch(() => {});
        },
      }
    : undefined,
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    // Required on http://localhost so the OAuth callback can read state/code_verifier
    useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
  },
};

if (process.env.NODE_ENV === "development" && (!githubId || !githubSecret)) {
  console.warn(
    "[NextAuth] GITHUB_ID or GITHUB_SECRET is missing in .env. GitHub sign-in will fail. Copy from .env.example and set values from your GitHub OAuth App."
  );
}
