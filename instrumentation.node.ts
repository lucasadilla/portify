/**
 * Node-only instrumentation. Runs when Next.js server starts (Node runtime).
 * In development, starts the Portify BullMQ worker in a child process.
 */
import { spawn } from "child_process";
import path from "path";

export async function register() {
  if (process.env.NODE_ENV !== "development") return;
  if (!process.env.REDIS_URL) return;

  try {
    const workerPath = path.join(process.cwd(), "worker", "index.ts");
    const isWin = process.platform === "win32";
    const child = spawn("npx", ["tsx", workerPath], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: "1" },
      shell: isWin,
    });
    child.on("error", (err) => {
      console.warn("[Portify] Worker process error:", err.message);
    });
    console.log("[Portify] Worker started in background. Jobs will be processed.");
  } catch (err) {
    console.warn("[Portify] Worker failed to start. Run 'npm run worker' in a separate terminal. Error:", err);
  }
}
