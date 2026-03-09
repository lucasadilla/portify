/**
 * Palette of distinct badge color classes (bg, text, border) for tech stack badges.
 * Same tech name always gets the same color.
 */
const TECH_BADGE_PALETTE = [
  // Blue
  "border-blue-500/80 bg-blue-500/25 text-blue-900 dark:bg-blue-500/40 dark:text-blue-50",
  // Emerald / green
  "border-emerald-500/80 bg-emerald-500/25 text-emerald-900 dark:bg-emerald-500/40 dark:text-emerald-50",
  // Violet / purple
  "border-violet-500/80 bg-violet-500/25 text-violet-900 dark:bg-violet-500/40 dark:text-violet-50",
  // Amber / yellow
  "border-amber-500/80 bg-amber-500/25 text-amber-900 dark:bg-amber-500/40 dark:text-amber-50",
  // Rose / red-pink
  "border-rose-500/80 bg-rose-500/25 text-rose-900 dark:bg-rose-500/40 dark:text-rose-50",
  // Sky
  "border-sky-500/80 bg-sky-500/25 text-sky-900 dark:bg-sky-500/40 dark:text-sky-50",
  // Teal
  "border-teal-500/80 bg-teal-500/25 text-teal-900 dark:bg-teal-500/40 dark:text-teal-50",
  // Indigo
  "border-indigo-500/80 bg-indigo-500/25 text-indigo-900 dark:bg-indigo-500/40 dark:text-indigo-50",
  // Fuchsia
  "border-fuchsia-500/80 bg-fuchsia-500/25 text-fuchsia-900 dark:bg-fuchsia-500/40 dark:text-fuchsia-50",
  // Orange
  "border-orange-500/80 bg-orange-500/25 text-orange-900 dark:bg-orange-500/40 dark:text-orange-50",
  // Cyan
  "border-cyan-500/80 bg-cyan-500/25 text-cyan-900 dark:bg-cyan-500/40 dark:text-cyan-50",
  // Pink
  "border-pink-500/80 bg-pink-500/25 text-pink-900 dark:bg-pink-500/40 dark:text-pink-50",
] as const;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Returns a consistent Tailwind class string for a tech/label so badges get different colors. */
export function getTechBadgeClassName(label: string): string {
  const i = hashString(label) % TECH_BADGE_PALETTE.length;
  return TECH_BADGE_PALETTE[i];
}
