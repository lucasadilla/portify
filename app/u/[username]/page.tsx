import { redirect } from "next/navigation";

export default async function LegacyPortfolioRedirect({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  redirect(`/${username.toLowerCase().trim()}`);
}
