import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { getGitHubRepos } from "@/lib/github";

export async function GET(request: Request) {
  const token = await getAccessToken(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const repos = await getGitHubRepos(token);
    // Include private repos: OAuth uses `repo` scope so we can clone and analyze them.
    return NextResponse.json(repos);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
