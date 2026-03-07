"use client";

export function MeshGradientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div
        className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-40 blur-[100px] animate-mesh-1"
        style={{
          background: "radial-gradient(circle, hsl(280 70% 50%) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-40 blur-[100px] animate-mesh-2"
        style={{
          background: "radial-gradient(circle, hsl(330 70% 45%) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full opacity-30 blur-[120px] animate-mesh-3"
        style={{
          background: "radial-gradient(circle, hsl(220 70% 45%) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-0 right-0 w-1/2 h-1/2 rounded-full opacity-25 blur-[80px] animate-mesh-2"
        style={{
          background: "radial-gradient(circle, hsl(30 80% 50%) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
