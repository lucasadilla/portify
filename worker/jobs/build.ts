import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { setRepoStatus, upsertJob } from "../lib/db";
import type { RunPlan } from "../../lib/stackDetector";

const BUILD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const HEALTH_POLL_MS = 2000;
const HEALTH_TIMEOUT_MS = 60 * 1000; // 60 seconds

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    const t = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ ok: false, stderr: stderr || "Timeout" });
    }, timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(t);
      resolve({ ok: code === 0, stderr });
    });
    proc.on("error", () => {
      clearTimeout(t);
      resolve({ ok: false, stderr: "Spawn error" });
    });
  });
}

async function waitForPort(port: number): Promise<boolean> {
  const start = Date.now();
  const http = await import("http");
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
          res.resume();
          resolve();
        });
        req.on("error", reject);
        req.setTimeout(3000, () => {
          req.destroy();
          reject(new Error("timeout"));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
    }
  }
  return false;
}

export interface BuildResult {
  runnable: boolean;
  port?: number;
  serverProcess?: ReturnType<typeof spawn>;
  containerName?: string;
}

export async function runBuild(
  portfolioRepoId: string,
  repoDir: string,
  runPlan: RunPlan
): Promise<BuildResult> {
  await upsertJob(portfolioRepoId, "build", "ACTIVE", 10, null);

  const { strategy, port, installCommand, buildCommand, startCommandForRun } = runPlan;
  const workingDir = path.join(repoDir, runPlan.workingDir || ".");
  if (!fs.existsSync(workingDir)) {
    await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, "Working dir not found");
    await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
    return { runnable: false };
  }

  // Docker-based strategies: build and run in isolated container
  if (strategy === "dockerfile") {
    const imageTag = `portify-${portfolioRepoId.toLowerCase().replace(/[^a-z0-9-]/g, "") || "image"}`;
    const containerName = `${imageTag}-ctr`;

    await upsertJob(portfolioRepoId, "build", "ACTIVE", 20, null);
    // docker build
    const buildDocker = await runCommand(workingDir, "docker", ["build", "-t", imageTag, "."], BUILD_TIMEOUT_MS);
    if (!buildDocker.ok) {
      await upsertJob(
        portfolioRepoId,
        "build",
        "COMPLETED",
        100,
        `Docker build failed: ${buildDocker.stderr.slice(0, 200)}`
      );
      await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
      return { runnable: false };
    }

    await upsertJob(portfolioRepoId, "build", "ACTIVE", 60, null);
    const dockerRunArgs = [
      "run",
      "-d",
      "--rm",
      "--name",
      containerName,
      "--cpus=1",
      "--memory=1g",
      "-p",
      `${port}:${port}`,
      imageTag,
    ];
    const runDocker = await runCommand(workingDir, "docker", dockerRunArgs, BUILD_TIMEOUT_MS);
    if (!runDocker.ok) {
      await runCommand(workingDir, "docker", ["rm", "-f", containerName], 30_000).catch(() => {});
      await upsertJob(
        portfolioRepoId,
        "build",
        "COMPLETED",
        100,
        `Docker run failed: ${runDocker.stderr.slice(0, 200)}`
      );
      await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
      return { runnable: false };
    }

    const ok = await waitForPort(port);
    if (!ok) {
      await runCommand(workingDir, "docker", ["rm", "-f", containerName], 30_000).catch(() => {});
      await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, "Container did not become ready in time");
      await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
      return { runnable: false, containerName };
    }

    await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, null);
    await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: true });
    return { runnable: true, port, containerName };
  }

  if (strategy === "docker-compose") {
    await upsertJob(portfolioRepoId, "build", "ACTIVE", 20, null);
    const up = await runCommand(
      workingDir,
      "docker",
      ["compose", "up", "-d", "--remove-orphans"],
      BUILD_TIMEOUT_MS
    );
    if (!up.ok) {
      await upsertJob(
        portfolioRepoId,
        "build",
        "COMPLETED",
        100,
        `docker compose up failed: ${up.stderr.slice(0, 200)}`
      );
      await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
      return { runnable: false };
    }

    const ok = await waitForPort(port);
    if (!ok) {
      await runCommand(workingDir, "docker", ["compose", "down", "--remove-orphans"], 60_000).catch(() => {});
      await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, "Service did not become ready in time");
      await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
      return { runnable: false };
    }

    await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, null);
    await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: true });
    return { runnable: true, port };
  }

  const pm = runPlan.packageManager ?? "npm";
  const installArgs = pm === "yarn" ? [] : pm === "pnpm" ? ["install", "--frozen-lockfile"] : ["ci"];
  const installCmd = pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : "npm";

  await upsertJob(portfolioRepoId, "build", "ACTIVE", 30, null);
  const installResult = await runCommand(workingDir, installCmd, installArgs, BUILD_TIMEOUT_MS);
  if (!installResult.ok) {
    await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, `Install failed: ${installResult.stderr.slice(0, 200)}`);
    await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
    return { runnable: false };
  }

  if (buildCommand) {
    await upsertJob(portfolioRepoId, "build", "ACTIVE", 50, null);
    const [bc, ...bArgs] = buildCommand.split(/\s+/);
    const buildResult = await runCommand(workingDir, bc, bArgs.length ? bArgs : [], BUILD_TIMEOUT_MS);
    if (!buildResult.ok) {
      await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, `Build failed: ${buildResult.stderr.slice(0, 200)}`);
      await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
      return { runnable: false };
    }
  }

  await upsertJob(portfolioRepoId, "build", "ACTIVE", 70, null);
  const [sc, ...sArgs] = startCommandForRun.split(/\s+/);
  const serverProcess = spawn(sc, sArgs.length ? sArgs : [], {
    cwd: workingDir,
    shell: true,
    stdio: "ignore",
    env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
  });

  let runnable = false;
  try {
    runnable = await waitForPort(port);
  } catch {
    runnable = false;
  }

  if (!runnable) {
    serverProcess.kill("SIGKILL");
    await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, "Server did not respond in time");
    await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: false });
    return { runnable: false };
  }

  await upsertJob(portfolioRepoId, "build", "COMPLETED", 100, null);
  await setRepoStatus(portfolioRepoId, "PROCESSING", { runnable: true });
  return { runnable: true, port, serverProcess };
}

export async function cleanupBuild(buildResult: BuildResult, runPlan: RunPlan, repoDir: string): Promise<void> {
  try {
    if (runPlan.strategy === "dockerfile" && buildResult.containerName) {
      await runCommand(repoDir, "docker", ["rm", "-f", buildResult.containerName], 30_000);
    } else if (runPlan.strategy === "docker-compose") {
      await runCommand(repoDir, "docker", ["compose", "down", "--remove-orphans"], 60_000);
    } else if (buildResult.serverProcess) {
      buildResult.serverProcess.kill("SIGKILL");
    }
  } catch {
    // best-effort cleanup
  }
}
