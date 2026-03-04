export type RunStrategy = "docker-compose" | "dockerfile" | "framework-recipe";

export interface RunPlan {
  packageManager?: "npm" | "yarn" | "pnpm";
  framework?: string;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  likelyPort?: number;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  /** Run strategy for screenshot pipeline */
  strategy: RunStrategy;
  /** Command to start the app (for framework-recipe) */
  startCommandForRun: string;
  /** Port to health-check and screenshot */
  port: number;
  /** Working directory relative to repo root */
  workingDir: string;
}

export function detectStack(files: string[], packageJson?: Record<string, unknown>): RunPlan {
  const fileSet = new Set(files.map((f) => f.toLowerCase()));
  const hasDockerfile =
    fileSet.has("dockerfile") ||
    fileSet.has("dockerfile.dev") ||
    files.some((f) => f.toLowerCase().startsWith("dockerfile"));
  const hasDockerCompose =
    fileSet.has("docker-compose.yml") ||
    fileSet.has("docker-compose.yaml") ||
    fileSet.has("compose.yml") ||
    fileSet.has("compose.yaml");

  const plan: RunPlan = {
    hasDockerfile,
    hasDockerCompose,
    strategy: "framework-recipe",
    startCommandForRun: "npm start",
    port: 3000,
    workingDir: ".",
  };

  if (packageJson && typeof packageJson === "object") {
    const scripts = (packageJson.scripts as Record<string, string>) ?? {};
    const deps = { ...(packageJson.dependencies as Record<string, string>), ...(packageJson.devDependencies as Record<string, string>) };
    if (deps["next"]) {
      plan.framework = "next";
      plan.packageManager = fileSet.has("yarn.lock") ? "yarn" : fileSet.has("pnpm-lock.yaml") ? "pnpm" : "npm";
      plan.installCommand = plan.packageManager === "yarn" ? "yarn" : plan.packageManager === "pnpm" ? "pnpm i" : "npm ci";
      // Prefer dev server when there's no explicit start, so we can run more apps out of the box.
      if (scripts["start"]) {
        plan.buildCommand =
          scripts["build"] ??
          (plan.packageManager === "yarn"
            ? "yarn build"
            : plan.packageManager === "pnpm"
            ? "pnpm build"
            : "npm run build");
        plan.startCommand = scripts["start"];
        plan.startCommandForRun = plan.startCommand;
      } else if (scripts["dev"]) {
        // No start script – use dev server and skip build step.
        plan.buildCommand = undefined;
        plan.startCommand = `npm run dev`;
        plan.startCommandForRun = plan.startCommand;
      }
      plan.likelyPort = 3000;
      plan.port = 3000;
    } else if (deps["vite"] || deps["react"]) {
      plan.framework = "vite";
      plan.packageManager = fileSet.has("yarn.lock") ? "yarn" : fileSet.has("pnpm-lock.yaml") ? "pnpm" : "npm";
      plan.installCommand = plan.packageManager === "yarn" ? "yarn" : plan.packageManager === "pnpm" ? "pnpm i" : "npm ci";
      if (scripts["dev"]) {
        // Most simple frontends only need dev server for screenshots.
        plan.buildCommand = undefined;
        plan.startCommand = `${plan.packageManager === "yarn" ? "yarn dev" : plan.packageManager === "pnpm" ? "pnpm dev" : "npm run dev"}`;
        plan.startCommandForRun = plan.startCommand;
      } else {
        plan.buildCommand = scripts["build"] ?? "npm run build";
        plan.startCommand = scripts["preview"] ?? "npm run preview";
        plan.startCommandForRun = plan.startCommand ?? "npm run preview";
      }
      // Vite default ports
      plan.likelyPort = deps["vite"] ? 5173 : 3000;
      plan.port = plan.likelyPort;
    } else if (scripts["build"] || scripts["start"]) {
      plan.packageManager = fileSet.has("yarn.lock") ? "yarn" : fileSet.has("pnpm-lock.yaml") ? "pnpm" : "npm";
      plan.installCommand = plan.packageManager === "yarn" ? "yarn" : plan.packageManager === "pnpm" ? "pnpm i" : "npm ci";
      if (scripts["start"]) {
        plan.buildCommand = scripts["build"];
        plan.startCommand = scripts["start"];
        plan.startCommandForRun = plan.startCommand ?? "npm start";
      } else if (scripts["dev"]) {
        // If there's no start but there is dev, use dev and skip build.
        plan.buildCommand = undefined;
        plan.startCommand = "npm run dev";
        plan.startCommandForRun = plan.startCommand;
      }
      plan.likelyPort = 3000;
      plan.port = 3000;
    }
  }

  if (hasDockerCompose) {
    plan.strategy = "docker-compose";
    plan.startCommandForRun = "docker compose up";
    plan.port = plan.likelyPort ?? 3000;
  } else if (hasDockerfile) {
    plan.strategy = "dockerfile";
    plan.startCommandForRun = "docker run";
    plan.port = plan.likelyPort ?? 3000;
  }

  return plan;
}
