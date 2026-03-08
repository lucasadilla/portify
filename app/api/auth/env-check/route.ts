import { NextResponse } from "next/server";

/**
 * Dev-only: check that auth-related env vars are present (no values shown).
 * DELETE this route or restrict by NODE_ENV before production.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const vars = {
    GITHUB_ID: !!(process.env.GITHUB_ID?.trim()),
    GITHUB_SECRET: !!(process.env.GITHUB_SECRET?.trim()),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    NEXTAUTH_SECRET: !!(process.env.NEXTAUTH_SECRET?.trim()),
  };
  const allSet = vars.GITHUB_ID && vars.GITHUB_SECRET && vars.NEXTAUTH_URL && vars.NEXTAUTH_SECRET;
  return NextResponse.json({
    ok: allSet,
    env: vars,
    hint: !allSet
      ? "Set missing vars in .env and restart the dev server. NEXTAUTH_URL must be exactly http://localhost:3000 (no trailing slash) when using localhost."
      : "All auth env vars are set. If sign-in still fails, check GitHub OAuth App callback URL and terminal [NextAuth] logs.",
  });
}
