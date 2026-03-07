"use client";

export function GridGlowBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#08080c]" aria-hidden>
      {/* Grid lines - visible neon style */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(120, 80, 255, 0.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120, 80, 255, 0.18) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />
      {/* Stronger glow from top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 100% 80% at 50% -30%, rgba(120, 80, 255, 0.35), transparent 55%)",
        }}
      />
      {/* Subtle vignette glow at bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 120%, rgba(80, 60, 180, 0.12), transparent 60%)",
        }}
      />
    </div>
  );
}
