import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  allowDangerousEmailAccountLinking: true,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
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
    error: "/auth-error",
  },
  events: {
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
  },
  secret: process.env.NEXTAUTH_SECRET,
};
