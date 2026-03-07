"use client";

export function StaticGradientBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5"
      aria-hidden
    />
  );
}
