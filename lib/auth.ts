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
          login: profile.login,
          avatar_url: profile.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile && "login" in profile && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            username: (profile as { login?: string }).login ?? user.name ?? undefined,
            avatarUrl: (profile as { avatar_url?: string }).avatar_url ?? user.image ?? undefined,
          },
        }).catch(() => {});
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const u = user as { username?: string | null };
        session.user.username = u.username ?? (user as { name?: string | null }).name ?? "";
      }
      return session;
    },
  },
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
