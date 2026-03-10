import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Single endpoint for the generate page to poll: returns portfolio plus
 * job detail for the first in-progress repo. One request per poll instead of two.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: session.user.id },
    include: {
      repos: {
        orderBy: { pinnedOrder: "asc" },
        include: { artifacts: true },
      },
    },
  });

  if (!portfolio) return Response.json({ portfolio: null, activeJob: null });

  const payload: {
    portfolio: typeof portfolio & { socialsJson?: Record<string, unknown> };
    activeJob: {
      repoFullName: string;
      status: string;
      jobs: { type: string; status: string; progress: number }[];
    } | null;
  } = {
    portfolio: {
      ...portfolio,
      socialsJson: portfolio.socialsJson ? (JSON.parse(portfolio.socialsJson) as Record<string, unknown>) : {},
    },
    activeJob: null,
  };

  const pending = portfolio.repos.find(
    (r) => r.status === "QUEUED" || r.status === "PROCESSING"
  );
  if (pending) {
    const withJobs = await prisma.portfolioRepo.findUnique({
      where: { id: pending.id },
      include: { jobs: true },
    });
    if (withJobs) {
      payload.activeJob = {
        repoFullName: withJobs.repoFullName,
        status: withJobs.status,
        jobs: withJobs.jobs.map((j) => ({ type: j.type, status: j.status, progress: j.progress })),
      };
    }
  }

  return Response.json(payload);
}
