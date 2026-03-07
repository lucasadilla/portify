"use client";

export function NoiseBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-background" aria-hidden>
      {/* Film grain overlay - visible but not overwhelming */}
      <div
        className="absolute inset-0 w-full h-full opacity-[0.12] dark:opacity-[0.14] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
