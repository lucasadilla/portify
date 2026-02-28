import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const { prisma } = await import("@/lib/db");
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  });
  return account?.access_token ?? null;
}
