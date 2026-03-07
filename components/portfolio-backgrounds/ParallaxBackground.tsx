"use client";

export function ParallaxBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-30"
        style={{
          background: "radial-gradient(circle at 30% 40%, rgba(120, 80, 255, 0.25) 0%, transparent 45%)",
        }}
      />
      <div
        className="absolute -bottom-1/2 -right-1/2 w-[180%] h-[180%] opacity-25"
        style={{
          background: "radial-gradient(circle at 70% 60%, rgba(99, 102, 241, 0.2) 0%, transparent 50%)",
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-[60%] opacity-20"
        style={{
          background: "linear-gradient(180deg, rgba(120, 80, 255, 0.15) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
