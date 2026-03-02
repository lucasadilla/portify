import * as path from "path";
import { chromium } from "playwright";
import { prisma } from "../../lib/db";
import { upsertJob } from "../lib/db";
import { uploadBuffer, s3 } from "../../lib/s3";
import type { RunPlan } from "../../lib/stackDetector";
import { readFileSafe } from "./analyze";
import type { BuildResult } from "./build";

const MAX_SCREENSHOTS = 3;
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 13
const LOAD_WAIT_MS = 1000;

async function getUserIdAndRepoId(
  portfolioRepoId: string
): Promise<{ userId: string; repoId: string; repoFullName: string } | null> {
  const repo = await prisma.portfolioRepo.findUnique({
    where: { id: portfolioRepoId },
    select: { id: true, repoFullName: true, portfolio: { select: { userId: true } } },
  });
  if (!repo?.portfolio) return null;
  return { userId: repo.portfolio.userId, repoId: repo.id, repoFullName: repo.repoFullName };
}

function s3Key(userId: string, repoId: string, name: string, ext = "png"): string {
  return `${userId}/${repoId}/${name}.${ext}`;
}

/** Extract first image URL from README (markdown or html img) */
function extractFirstImageFromReadme(readme: string): string | null {
  const imgRegex = /!\[[^\]]*\]\(([^)\s]+)\)/;
  const match = readme.match(imgRegex);
  if (match?.[1]) return match[1];
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const htmlMatch = readme.match(htmlImgRegex);
  return htmlMatch?.[1] ?? null;
}

/** Extract homepage or demo URL from package.json */
function extractHomepage(repoDir: string): string | null {
  const raw = readFileSafe(repoDir, "package.json");
  if (!raw) return null;
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const homepage = pkg.homepage;
    if (typeof homepage === "string" && /^https?:\/\//i.test(homepage)) return homepage;
  } catch {
    // ignore
  }
  return null;
}

/** Generate placeholder SVG */
function createPlaceholderSvg(repoName: string, stack: string[]): Buffer {
  const stackStr = stack.slice(0, 5).join(", ") || "—";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <rect fill="#1e293b" width="800" height="500"/>
    <text x="400" y="180" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="24" text-anchor="middle">${escapeXml(repoName)}</text>
    <text x="400" y="240" fill="#64748b" font-family="system-ui,sans-serif" font-size="14" text-anchor="middle">${escapeXml(stackStr)}</text>
    <text x="400" y="300" fill="#475569" font-family="system-ui,sans-serif" font-size="16" text-anchor="middle">Demo not available</text>
  </svg>`;
  return Buffer.from(svg, "utf-8");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function createArtifact(portfolioRepoId: string, url: string, caption?: string): Promise<void> {
  await prisma.repoArtifact.create({
    data: {
      portfolioRepoId,
      type: "screenshot",
      url,
      metadata: caption ? JSON.stringify({ caption }) : undefined,
    },
  });
}

export async function runScreenshot(
  portfolioRepoId: string,
  repoDir: string,
  runPlan: RunPlan,
  buildResult: BuildResult
): Promise<void> {
  await upsertJob(portfolioRepoId, "screenshot", "ACTIVE", 0, null);

  const meta = await getUserIdAndRepoId(portfolioRepoId);
  const stack = runPlan.framework ? [runPlan.framework] : [];
  const repoName = path.basename(repoDir.replace(/-/g, "/").split("/").pop() ?? "repo");
  let created = 0;

  const tryLiveScreenshots = async (): Promise<boolean> => {
    if (!buildResult.runnable || !buildResult.port) return false;
    const s3Available = !!s3 && !!meta;
    const baseUrl = `http://127.0.0.1:${buildResult.port}`;
    try {
      const browser = await chromium.launch({ headless: true });

      // Desktop primary
      const page = await browser.newPage();
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.addStyleTag({
        content:
          "* { transition: none !important; animation: none !important; scroll-behavior: auto !important; } html, body { scroll-behavior: auto !important; }",
      });
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(LOAD_WAIT_MS);
      const desktopBuf = await page.screenshot({ type: "png", fullPage: true });
      const desktopUrl =
        s3Available && meta
          ? await uploadBuffer(s3Key(meta.userId, meta.repoId, "desktop"), Buffer.from(desktopBuf), "image/png")
          : `data:image/png;base64,${Buffer.from(desktopBuf).toString("base64")}`;
      const urlDesktop = desktopUrl;
      await createArtifact(portfolioRepoId, urlDesktop, "Desktop view");
      created++;

      // Optional secondary internal page
      if (created < MAX_SCREENSHOTS) {
        const navLinks = await page.locator('a[href]').elementHandles();
        for (const link of navLinks) {
          const href = (await link.getAttribute("href")) || "";
          if (!href || href.startsWith("#")) continue;
          // Internal link only
          if (/^https?:\/\//i.test(href)) continue;
          const targetUrl = new URL(href, baseUrl).toString();
          if (targetUrl === baseUrl) continue;
          try {
            await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
            await page.waitForTimeout(LOAD_WAIT_MS);
            const secondaryBuf = await page.screenshot({ type: "png", fullPage: true });
            const secondaryUrl =
              s3Available && meta
                ? await uploadBuffer(s3Key(meta.userId, meta.repoId, "page2"), Buffer.from(secondaryBuf), "image/png")
                : `data:image/png;base64,${Buffer.from(secondaryBuf).toString("base64")}`;
            const urlPage2 = secondaryUrl;
            await createArtifact(portfolioRepoId, urlPage2, "Secondary page");
            created++;
          } catch {
            // ignore and try next link
          }
          break;
        }
      }

      // Mobile
      if (created < MAX_SCREENSHOTS) {
        const mobilePage = await browser.newPage();
        await mobilePage.setViewportSize(MOBILE_VIEWPORT);
        await mobilePage.addStyleTag({
          content:
            "* { transition: none !important; animation: none !important; scroll-behavior: auto !important; } html, body { scroll-behavior: auto !important; }",
        });
        await mobilePage.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
        await mobilePage.waitForTimeout(LOAD_WAIT_MS);
        const mobileBuf = await mobilePage.screenshot({ type: "png", fullPage: true });
        const mobileUrl =
          s3Available && meta
            ? await uploadBuffer(s3Key(meta.userId, meta.repoId, "mobile"), Buffer.from(mobileBuf), "image/png")
            : `data:image/png;base64,${Buffer.from(mobileBuf).toString("base64")}`;
        const urlMobile = mobileUrl;
        await createArtifact(portfolioRepoId, urlMobile, "Mobile view");
        created++;
      }

      await browser.close();
      return true;
    } catch {
      return false;
    }
  };

  const tryFallbackReadmeImage = async (): Promise<boolean> => {
    const readme = readFileSafe(repoDir, "README.md") || readFileSafe(repoDir, "readme.md") || "";
    const firstImageUrl = extractFirstImageFromReadme(readme);
    if (!firstImageUrl) return false;
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.goto(firstImageUrl, { waitUntil: "load", timeout: 15000 });
      await page.waitForTimeout(LOAD_WAIT_MS);
      const buf = await page.screenshot({ type: "png" });
      await browser.close();
      if (meta && s3Available) {
        const key = s3Key(meta.userId, meta.repoId, "fallback");
        const url = await uploadBuffer(key, Buffer.from(buf), "image/png");
        await createArtifact(portfolioRepoId, url, "Screenshot from README");
      } else {
        await createArtifact(portfolioRepoId, firstImageUrl);
      }
      created++;
      return true;
    } catch {
      await createArtifact(portfolioRepoId, firstImageUrl);
      created++;
      return true;
    }
  };

  const tryFallbackHomepage = async (): Promise<boolean> => {
    const homepage = extractHomepage(repoDir);
    if (!homepage) return false;
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.goto(homepage, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(LOAD_WAIT_MS);
      const buf = await page.screenshot({ type: "png" });
      await browser.close();
      if (meta && s3Available) {
        const key = s3Key(meta.userId, meta.repoId, "deployment");
        const url = await uploadBuffer(key, Buffer.from(buf), "image/png");
        await createArtifact(portfolioRepoId, url, "Live deployment");
      } else {
        const dataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
        await createArtifact(portfolioRepoId, dataUrl, "Live deployment");
      }
      created++;
      return true;
    } catch {
      return false;
    }
  };

  const tryFallbackGitHubRepo = async (): Promise<boolean> => {
    if (!meta) return false;
    const repoUrl = `https://github.com/${meta.repoFullName}`;
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.goto(repoUrl, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(LOAD_WAIT_MS);
      const buf = await page.screenshot({ type: "png" });
      await browser.close();
      const s3Available = !!s3;
      if (s3Available) {
        const key = s3Key(meta.userId, meta.repoId, "github-repo");
        const url = await uploadBuffer(key, Buffer.from(buf), "image/png");
        await createArtifact(portfolioRepoId, url, "GitHub repository page");
      } else {
        const dataUrl = `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
        await createArtifact(portfolioRepoId, dataUrl, "GitHub repository page");
      }
      created++;
      return true;
    } catch {
      return false;
    }
  };

  const ensurePlaceholder = async (): Promise<void> => {
    if (created > 0) return;
    const placeholder = createPlaceholderSvg(repoName, stack);
    const dataUrl = `data:image/svg+xml;base64,${placeholder.toString("base64")}`;
    if (s3Available && meta) {
      try {
        const key = s3Key(meta.userId, meta.repoId, "placeholder", "svg");
        const url = await uploadBuffer(key, placeholder, "image/svg+xml");
        await createArtifact(portfolioRepoId, url, "Demo not available");
        return;
      } catch {
        // fall through to data URL
      }
    }
    await createArtifact(portfolioRepoId, dataUrl, "Demo not available");
  };

  try {
    await tryLiveScreenshots();
    if (created === 0) await tryFallbackReadmeImage();
    if (created === 0) await tryFallbackHomepage();
    if (created === 0) await tryFallbackGitHubRepo();
    await ensurePlaceholder();
  } catch {
    try {
      await ensurePlaceholder();
    } catch {
      // last resort: artifact with inline placeholder
      const placeholder = createPlaceholderSvg(repoName, stack);
      const dataUrl = `data:image/svg+xml;base64,${placeholder.toString("base64")}`;
      await prisma.repoArtifact.create({
        data: { portfolioRepoId, type: "screenshot", url: dataUrl, metadata: JSON.stringify({ caption: "Demo not available" }) },
      }).catch(() => {});
    }
  }

  await upsertJob(portfolioRepoId, "screenshot", "COMPLETED", 100, null);
}
