export interface RunPlan {
  packageManager?: "npm" | "yarn" | "pnpm";
  framework?: string;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  likelyPort?: number;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
}

export function detectStack(files: string[], packageJson?: Record<string, unknown>): RunPlan {
  const plan: RunPlan = { hasDockerfile: false, hasDockerCompose: false };
  const fileSet = new Set(files.map((f) => f.toLowerCase()));

  if (fileSet.has("dockerfile") || fileSet.has("dockerfile.dev") || files.some((f) => f.toLowerCase().startsWith("dockerfile"))) {
    plan.hasDockerfile = true;
  }
  if (fileSet.has("docker-compose.yml") || fileSet.has("docker-compose.yaml") || fileSet.has("compose.yml") || fileSet.has("compose.yaml")) {
    plan.hasDockerCompose = true;
  }

  if (packageJson && typeof packageJson === "object") {
    const scripts = (packageJson.scripts as Record<string, string>) ?? {};
    const deps = { ...(packageJson.dependencies as Record<string, string>), ...(packageJson.devDependencies as Record<string, string>) };
    if (deps["next"]) {
      plan.framework = "next";
      plan.packageManager = fileSet.has("yarn.lock") ? "yarn" : fileSet.has("pnpm-lock.yaml") ? "pnpm" : "npm";
      plan.installCommand = plan.packageManager === "yarn" ? "yarn" : plan.packageManager === "pnpm" ? "pnpm i" : "npm ci";
      plan.buildCommand = scripts["build"] ?? (plan.packageManager === "yarn" ? "yarn build" : plan.packageManager === "pnpm" ? "pnpm build" : "npm run build");
      plan.startCommand = scripts["start"] ?? (plan.packageManager === "yarn" ? "yarn start" : plan.packageManager === "pnpm" ? "pnpm start" : "npm start");
      plan.likelyPort = 3000;
    } else if (deps["vite"] || deps["react"]) {
      plan.framework = "vite";
      plan.packageManager = fileSet.has("yarn.lock") ? "yarn" : fileSet.has("pnpm-lock.yaml") ? "pnpm" : "npm";
      plan.installCommand = plan.packageManager === "yarn" ? "yarn" : plan.packageManager === "pnpm" ? "pnpm i" : "npm ci";
      plan.buildCommand = scripts["build"] ?? "npm run build";
      plan.startCommand = scripts["preview"] ?? "npm run preview";
      plan.likelyPort = 5173;
    } else if (scripts["build"] || scripts["start"]) {
      plan.packageManager = fileSet.has("yarn.lock") ? "yarn" : fileSet.has("pnpm-lock.yaml") ? "pnpm" : "npm";
      plan.installCommand = plan.packageManager === "yarn" ? "yarn" : plan.packageManager === "pnpm" ? "pnpm i" : "npm ci";
      plan.buildCommand = scripts["build"];
      plan.startCommand = scripts["start"];
      plan.likelyPort = 3000;
    }
  }

  return plan;
}
