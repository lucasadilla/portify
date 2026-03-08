/**
 * Shared data for the /demo portfolio and /demo/[repo] project pages.
 */

export const DEMO_EVOLUTION = [
  { month: "2023-06", commits: 8 },
  { month: "2023-07", commits: 14 },
  { month: "2023-08", commits: 22 },
  { month: "2023-09", commits: 18 },
  { month: "2023-10", commits: 31 },
  { month: "2023-11", commits: 27 },
  { month: "2023-12", commits: 19 },
  { month: "2024-01", commits: 35 },
  { month: "2024-02", commits: 42 },
  { month: "2024-03", commits: 28 },
  { month: "2024-04", commits: 51 },
  { month: "2024-05", commits: 38 },
  { month: "2024-06", commits: 44 },
  { month: "2024-07", commits: 29 },
  { month: "2024-08", commits: 33 },
  { month: "2024-09", commits: 47 },
  { month: "2024-10", commits: 41 },
  { month: "2024-11", commits: 39 },
  { month: "2024-12", commits: 52 },
];

export const DEMO_LANGUAGES = [
  { name: "TypeScript", value: 38 },
  { name: "JavaScript", value: 22 },
  { name: "CSS", value: 14 },
  { name: "Python", value: 10 },
  { name: "Shell", value: 6 },
  { name: "Other", value: 10 },
];

export const DEMO_DEVELOPER_TIMELINE = [
  {
    kind: "account" as const,
    id: "demo-github",
    date: "2020-03-15",
    year: 2020,
    title: "Joined GitHub",
    subtitle: "Created @demodev",
  },
  {
    kind: "repo" as const,
    id: "demo-1",
    date: "2023-06-01",
    year: 2023,
    title: "Portify",
    subtitle: "AI-powered developer portfolio infrastructure. Transforms GitHub repos into a live portfolio.",
    repoFullName: "portify/portify",
    language: "TypeScript",
    stars: 128,
    hasProjectPage: true,
    stack: ["Next.js", "TypeScript", "Prisma", "TailwindCSS", "OpenAI"],
  },
  {
    kind: "repo" as const,
    id: "demo-2",
    date: "2023-09-12",
    year: 2023,
    title: "API Gateway",
    subtitle: "High-performance API gateway with rate limiting and caching.",
    repoFullName: "demodev/api-gateway",
    language: "Go",
    stars: 89,
    hasProjectPage: true,
    stack: ["Go", "Redis", "Docker"],
  },
  {
    kind: "custom" as const,
    id: "demo-career-1",
    date: "2024-01-10",
    year: 2024,
    title: "Senior Engineer",
    subtitle: "Joined Platform team at a product company.",
    customKind: "job_start",
  },
  {
    kind: "repo" as const,
    id: "demo-3",
    date: "2024-02-20",
    year: 2024,
    title: "Design System",
    subtitle: "Component library and design tokens for web and mobile.",
    repoFullName: "demodev/design-system",
    language: "TypeScript",
    stars: 234,
    hasProjectPage: true,
    stack: ["React", "TypeScript", "TailwindCSS", "Figma"],
  },
];

const DEMO_REPOS_RAW = [
  {
    id: "demo-1",
    repoFullName: "portify/portify",
    customTitle: "Portify",
    customSummary:
      "AI-powered developer portfolio infrastructure. Transforms GitHub repos into a live portfolio with AI summaries, tech stack detection, and evolution graphs. Built with Next.js, Prisma, and OpenAI.",
    detectedStackJson: JSON.stringify(["Next.js", "TypeScript", "Prisma", "TailwindCSS", "OpenAI"]),
    artifacts: [
      { id: "art-1", type: "screenshot", url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80" },
      { id: "art-2", type: "diagram", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", kind: "architecture" },
    ],
  },
  {
    id: "demo-2",
    repoFullName: "demodev/api-gateway",
    customTitle: "API Gateway",
    customSummary:
      "High-performance API gateway with rate limiting, caching, and request signing. Written in Go with Redis for distributed state. Deployed with Docker and Kubernetes.",
    detectedStackJson: JSON.stringify(["Go", "Redis", "Docker", "Kubernetes"]),
    artifacts: [],
  },
  {
    id: "demo-3",
    repoFullName: "demodev/design-system",
    customTitle: "Design System",
    customSummary:
      "Component library and design tokens for web and mobile. React components with Tailwind, Figma sync, and full accessibility. Used by 12+ product teams.",
    detectedStackJson: JSON.stringify(["React", "TypeScript", "TailwindCSS", "Figma"]),
    artifacts: [
      { id: "art-3", type: "screenshot", url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80" },
    ],
  },
];

export const DEMO_PORTFOLIO = {
  slug: "demo",
  bio: "Full-stack engineer focused on developer experience and platform tooling. I build with Next.js, TypeScript, and modern infra. Open-source contributor and occasional speaker. From commits to career.",
  theme: "dark",
  backgroundStyle: "mesh-gradient",
  displayName: "Demo Developer",
  sectionOrder: ["profile", "contributions", "developer_journey", "projects"],
  contributionsChartOrder: ["evolution", "languages"],
  colorPalette: "ocean",
  socials: {
    email: "demo@portify.dev",
    website: "https://portify.dev",
    linkedin: "https://linkedin.com/in/demo",
    github: "https://github.com/demodev",
    twitter: "https://twitter.com/demodev",
  },
  user: {
    name: "Demo Developer",
    image: "https://avatars.githubusercontent.com/u/1?v=4",
    email: "demo@portify.dev",
  },
  repos: DEMO_REPOS_RAW.map((r) => ({
    ...r,
    artifacts: r.artifacts as { id: string; type: string; url: string }[],
  })),
};

/** Get demo repo by name (e.g. "portify", "api-gateway", "design-system") for project page. */
export function getDemoRepoByName(repoName: string) {
  const name = repoName.toLowerCase();
  return DEMO_REPOS_RAW.find((r) => {
    const slug = r.repoFullName.split("/").pop()?.toLowerCase() ?? "";
    return slug === name;
  });
}

export const DEMO_BACKGROUND_STYLE = "mesh-gradient";
export const DEMO_COLOR_PALETTE = "ocean";
export const DEMO_CONTRIBUTIONS_CHART_ORDER = ["evolution", "languages"];
