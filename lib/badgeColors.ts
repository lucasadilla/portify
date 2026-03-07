/**
 * Palette of distinct badge color classes (bg, text, border) for tech stack badges.
 * Same tech name always gets the same color.
 */
const TECH_BADGE_PALETTE = [
  "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "border-teal-500/40 bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "border-pink-500/40 bg-pink-500/15 text-pink-700 dark:text-pink-300",
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
