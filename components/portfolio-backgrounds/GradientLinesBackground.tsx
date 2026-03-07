"use client";

export function GradientLinesBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0a0a0f]" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            105deg,
            transparent 0px,
            transparent 38px,
            rgba(120, 80, 255, 0.35) 38px,
            rgba(120, 80, 255, 0.35) 40px
          )`,
          backgroundSize: "100% 100%",
          animation: "portfolio-gradient-lines 20s linear infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `repeating-linear-gradient(
            75deg,
            transparent 0px,
            transparent 58px,
            rgba(99, 102, 241, 0.25) 58px,
            rgba(99, 102, 241, 0.25) 60px
          )`,
          backgroundSize: "100% 100%",
          animation: "portfolio-gradient-lines-60 28s linear infinite reverse",
        }}
      />
    </div>
  );
}
