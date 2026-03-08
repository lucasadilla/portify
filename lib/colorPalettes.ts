/**
 * Portfolio color palettes. Values are HSL without "hsl()" (Tailwind adds it).
 * Keys match CSS variables in globals.css.
 */
export type PaletteVars = {
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  border: string;
  input: string;
  ring: string;
};

export const COLOR_PALETTES: Record<string, { name: string; vars: PaletteVars; swatch: string }> = {
  default: {
    name: "Default",
    swatch: "hsl(222.2 84% 4.9%)",
    vars: {
      background: "222.2 84% 4.9%",
      foreground: "210 40% 98%",
      card: "222.2 84% 4.9%",
      "card-foreground": "210 40% 98%",
      primary: "210 40% 98%",
      "primary-foreground": "222.2 47.4% 11.2%",
      secondary: "217.2 32.6% 17.5%",
      "secondary-foreground": "210 40% 98%",
      muted: "217.2 32.6% 17.5%",
      "muted-foreground": "215 20.2% 65.1%",
      accent: "217.2 32.6% 17.5%",
      "accent-foreground": "210 40% 98%",
      border: "217.2 32.6% 17.5%",
      input: "217.2 32.6% 17.5%",
      ring: "212.7 26.8% 83.9%",
    },
  },
  ocean: {
    name: "Ocean",
    swatch: "hsl(199 89% 48%)",
    vars: {
      background: "210 50% 6%",
      foreground: "210 30% 96%",
      card: "210 45% 8%",
      "card-foreground": "210 30% 96%",
      primary: "199 89% 48%",
      "primary-foreground": "210 30% 98%",
      secondary: "210 40% 14%",
      "secondary-foreground": "210 30% 96%",
      muted: "210 35% 14%",
      "muted-foreground": "210 20% 60%",
      accent: "199 70% 25%",
      "accent-foreground": "210 30% 96%",
      border: "210 35% 18%",
      input: "210 35% 18%",
      ring: "199 89% 48%",
    },
  },
  forest: {
    name: "Forest",
    swatch: "hsl(142 71% 45%)",
    vars: {
      background: "140 30% 6%",
      foreground: "140 20% 96%",
      card: "140 35% 8%",
      "card-foreground": "140 20% 96%",
      primary: "142 71% 45%",
      "primary-foreground": "140 30% 98%",
      secondary: "140 25% 14%",
      "secondary-foreground": "140 20% 96%",
      muted: "140 25% 14%",
      "muted-foreground": "140 15% 58%",
      accent: "142 50% 22%",
      "accent-foreground": "140 20% 96%",
      border: "140 25% 18%",
      input: "140 25% 18%",
      ring: "142 71% 45%",
    },
  },
  sunset: {
    name: "Sunset",
    swatch: "hsl(24 95% 53%)",
    vars: {
      background: "20 25% 6%",
      foreground: "30 20% 96%",
      card: "20 30% 8%",
      "card-foreground": "30 20% 96%",
      primary: "24 95% 53%",
      "primary-foreground": "20 30% 12%",
      secondary: "20 28% 14%",
      "secondary-foreground": "30 20% 96%",
      muted: "20 25% 14%",
      "muted-foreground": "25 15% 58%",
      accent: "24 70% 28%",
      "accent-foreground": "30 20% 96%",
      border: "20 28% 18%",
      input: "20 28% 18%",
      ring: "24 95% 53%",
    },
  },
  rose: {
    name: "Rose",
    swatch: "hsl(346 77% 50%)",
    vars: {
      background: "340 25% 6%",
      foreground: "330 20% 96%",
      card: "340 30% 8%",
      "card-foreground": "330 20% 96%",
      primary: "346 77% 50%",
      "primary-foreground": "330 30% 98%",
      secondary: "340 28% 14%",
      "secondary-foreground": "330 20% 96%",
      muted: "340 25% 14%",
      "muted-foreground": "330 15% 58%",
      accent: "346 60% 25%",
      "accent-foreground": "330 20% 96%",
      border: "340 28% 18%",
      input: "340 28% 18%",
      ring: "346 77% 50%",
    },
  },
  violet: {
    name: "Violet",
    swatch: "hsl(263 70% 58%)",
    vars: {
      background: "260 30% 6%",
      foreground: "260 20% 96%",
      card: "260 35% 8%",
      "card-foreground": "260 20% 96%",
      primary: "263 70% 58%",
      "primary-foreground": "260 30% 98%",
      secondary: "260 28% 14%",
      "secondary-foreground": "260 20% 96%",
      muted: "260 25% 14%",
      "muted-foreground": "260 15% 58%",
      accent: "263 50% 28%",
      "accent-foreground": "260 20% 96%",
      border: "260 28% 18%",
      input: "260 28% 18%",
      ring: "263 70% 58%",
    },
  },
  slate: {
    name: "Slate",
    swatch: "hsl(215 20% 45%)",
    vars: {
      background: "222 25% 7%",
      foreground: "210 25% 92%",
      card: "222 28% 9%",
      "card-foreground": "210 25% 92%",
      primary: "215 25% 55%",
      "primary-foreground": "222 30% 10%",
      secondary: "217 22% 16%",
      "secondary-foreground": "210 25% 92%",
      muted: "217 22% 16%",
      "muted-foreground": "215 15% 55%",
      accent: "215 22% 20%",
      "accent-foreground": "210 25% 92%",
      border: "217 22% 20%",
      input: "217 22% 20%",
      ring: "215 25% 55%",
    },
  },
};

const DEFAULT_PALETTE_ID = "default";

export function getPaletteStyle(paletteId: string | null | undefined): Record<string, string> {
  const id = paletteId && COLOR_PALETTES[paletteId] ? paletteId : DEFAULT_PALETTE_ID;
  const palette = COLOR_PALETTES[id];
  if (!palette) return {};
  return Object.fromEntries(
    Object.entries(palette.vars).map(([key, value]) => [`--${key}`, value])
  );
}

export function getPaletteIds(): string[] {
  return Object.keys(COLOR_PALETTES);
}
