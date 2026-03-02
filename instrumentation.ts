/**
 * Runs once when the Next.js server starts.
 * Node-only logic (worker spawn) lives in instrumentation.node.ts so Edge runtime never loads it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register: registerNode } = await import("./instrumentation.node");
    await registerNode();
  }
}
