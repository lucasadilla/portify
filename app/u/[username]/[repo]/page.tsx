import { redirect } from "next/navigation";

export default async function LegacyProjectRedirect({
  params,
}: {
  params: Promise<{ username: string; repo: string }>;
}) {
  const { username, repo } = await params;
  redirect(`/${username.toLowerCase().trim()}/${encodeURIComponent(repo)}`);
}
