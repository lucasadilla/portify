import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const nextAuthHandler = NextAuth(authOptions);

export async function GET(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  try {
    return await nextAuthHandler(req, context as unknown);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[NextAuth] GET error:", e);
    }
    throw e;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  try {
    return await nextAuthHandler(req, context as unknown);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[NextAuth] POST error:", e);
    }
    throw e;
  }
}
