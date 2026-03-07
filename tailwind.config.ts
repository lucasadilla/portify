import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "mesh-1": { "0%, 100%": { transform: "translate(0, 0) scale(1)" }, "33%": { transform: "translate(5%, -5%) scale(1.05)" }, "66%": { transform: "translate(-3%, 3%) scale(0.98)" } },
        "mesh-2": { "0%, 100%": { transform: "translate(0, 0) scale(1)" }, "33%": { transform: "translate(-4%, 4%) scale(1.02)" }, "66%": { transform: "translate(3%, -2%) scale(0.99)" } },
        "mesh-3": { "0%, 100%": { transform: "translate(-50%, -50%) scale(1)" }, "50%": { transform: "translate(-50%, -50%) scale(1.08)" } },
        "gradient-lines-slide": { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(82px)" } },
      },
      animation: {
        "mesh-1": "mesh-1 15s ease-in-out infinite",
        "mesh-2": "mesh-2 18s ease-in-out infinite",
        "mesh-3": "mesh-3 12s ease-in-out infinite",
        "gradient-lines-slide": "gradient-lines-slide 25s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
