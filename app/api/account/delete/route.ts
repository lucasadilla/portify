import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/account/delete
 * Permanently deletes the signed-in user's account and all associated data
 * (portfolio, repos, artifacts, jobs, sessions, accounts).
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.delete({
    where: { id: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
