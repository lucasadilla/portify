import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getGitHubRepos } from "@/lib/github";

export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const repos = await getGitHubRepos(token);
    return NextResponse.json(repos.filter((r) => !r.private));
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
