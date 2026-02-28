import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PortfolioView } from "./PortfolioView";

const DEMO_PORTFOLIO = {
  slug: "demo",
  bio: "Full-stack developer building with Next.js, TypeScript, and modern tooling. From commits to career.",
  theme: "dark",
  socials: { email: "demo@portify.dev", website: "https://portify.dev", linkedin: "https://linkedin.com/in/demo" },
  user: {
    name: "Demo Developer",
    image: "https://avatars.githubusercontent.com/u/1?v=4",
    email: "demo@portify.dev",
  },
  repos: [
    {
      id: "demo-1",
      repoFullName: "portify/portify",
      customTitle: "Portify",
      customSummary: "AI-powered developer portfolio infrastructure. Transforms GitHub repos into a live portfolio with AI summaries, tech stack detection, and evolution graphs.",
      detectedStackJson: JSON.stringify(["Next.js", "TypeScript", "Prisma", "TailwindCSS", "OpenAI"]),
      artifacts: [] as { id: string; type: string; url: string }[],
    },
  ],
};

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const slug = username.toLowerCase().trim();
  const portfolio = await prisma.portfolio.findUnique({
    where: { slug, isPublished: true },
    include: {
      user: true,
      repos: {
        where: { status: "DONE" },
        orderBy: { pinnedOrder: "asc" },
        include: { artifacts: true },
      },
    },
  });

  if (!portfolio) {
    if (slug === "demo") {
      return <PortfolioView portfolio={DEMO_PORTFOLIO} />;
    }
    notFound();
  }

  const socials = portfolio.socialsJson ? JSON.parse(portfolio.socialsJson) : {};

  return (
    <PortfolioView
      portfolio={{
        slug: portfolio.slug,
        bio: portfolio.bio,
        theme: portfolio.theme,
        socials,
        user: {
          name: portfolio.user.name ?? portfolio.user.username ?? "Developer",
          image: portfolio.user.avatarUrl ?? portfolio.user.image,
          email: portfolio.user.email,
        },
        repos: portfolio.repos.map((r) => ({
          id: r.id,
          repoFullName: r.repoFullName,
          customTitle: r.customTitle,
          customSummary: r.customSummary,
          detectedStackJson: r.detectedStackJson,
          artifacts: r.artifacts,
        })),
      }}
    />
  );
}
