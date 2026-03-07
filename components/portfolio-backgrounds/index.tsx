"use client";

import { MinimalBackground } from "./MinimalBackground";
import { StaticGradientBackground } from "./StaticGradientBackground";
import { StaticDarkBackground } from "./StaticDarkBackground";
import { MeshGradientBackground } from "./MeshGradientBackground";
import { NoiseBackground } from "./NoiseBackground";
import { GridGlowBackground } from "./GridGlowBackground";
import { ParticleBackground } from "./ParticleBackground";
import { GradientLinesBackground } from "./GradientLinesBackground";
import { CodeRainBackground } from "./CodeRainBackground";
import { NetworkGraphBackground } from "./NetworkGraphBackground";
import { HexagonBackground } from "./HexagonBackground";
import { CircuitBackground } from "./CircuitBackground";
import { ParallaxBackground } from "./ParallaxBackground";
import { Wireframe3DBackground } from "./Wireframe3DBackground";
import { GitGraphBackground } from "./GitGraphBackground";

export const BACKGROUND_STYLES = [
  { value: "minimal", label: "Minimal", description: "Solid background" },
  { value: "static-dark", label: "Static dark", description: "Solid dark" },
  { value: "static-gradient", label: "Static gradient", description: "Subtle gradient" },
  { value: "mesh-gradient", label: "Animated mesh", description: "Soft moving gradients (Apple/Stripe)" },
  { value: "noise", label: "Noise / grain", description: "Film grain texture" },
  { value: "grid-glow", label: "Grid + glow", description: "Neon grid, tech look" },
  { value: "particle", label: "Particles", description: "Floating dots" },
  { value: "gradient-lines", label: "Gradient lines", description: "Diagonal moving lines" },
  { value: "code-rain", label: "Code rain", description: "Falling code (terminal style)" },
  { value: "network-graph", label: "Network graph", description: "Nodes and connections" },
  { value: "git-graph", label: "Git commit graph", description: "Commit-style dots and lines" },
  { value: "hexagon", label: "Hexagon grid", description: "Honeycomb pattern" },
  { value: "circuit", label: "Circuit board", description: "Motherboard traces" },
  { value: "parallax", label: "Parallax", description: "Layered gradients" },
  { value: "wireframe-3d", label: "3D wireframe", description: "Floating 3D shapes" },
] as const;

export type BackgroundStyleValue = (typeof BACKGROUND_STYLES)[number]["value"];

export function PortfolioBackground({ style }: { style: string }) {
  switch (style) {
    case "static-dark":
      return <StaticDarkBackground />;
    case "static-gradient":
      return <StaticGradientBackground />;
    case "mesh-gradient":
      return <MeshGradientBackground />;
    case "noise":
      return <NoiseBackground />;
    case "grid-glow":
      return <GridGlowBackground />;
    case "particle":
      return <ParticleBackground />;
    case "gradient-lines":
      return <GradientLinesBackground />;
    case "code-rain":
      return <CodeRainBackground />;
    case "network-graph":
      return <NetworkGraphBackground />;
    case "git-graph":
      return <GitGraphBackground />;
    case "hexagon":
      return <HexagonBackground />;
    case "circuit":
      return <CircuitBackground />;
    case "parallax":
      return <ParallaxBackground />;
    case "wireframe-3d":
      return <Wireframe3DBackground />;
    case "minimal":
    default:
      return <MinimalBackground />;
  }
}
