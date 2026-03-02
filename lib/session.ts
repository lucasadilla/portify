import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;
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
