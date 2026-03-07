"use client";

export function CircuitBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#060608]" aria-hidden>
      <svg className="absolute inset-0 w-full h-full opacity-[0.2]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="circuit-h" width="80" height="12" patternUnits="userSpaceOnUse">
            <line x1="0" y1="6" x2="80" y2="6" stroke="rgba(120, 80, 255, 0.6)" strokeWidth="1.2" />
            <circle cx="20" cy="6" r="2.5" fill="rgba(120, 80, 255, 0.5)" />
            <circle cx="40" cy="6" r="2.5" fill="rgba(120, 80, 255, 0.5)" />
            <circle cx="60" cy="6" r="2.5" fill="rgba(120, 80, 255, 0.5)" />
          </pattern>
          <pattern id="circuit-v" width="12" height="80" patternUnits="userSpaceOnUse">
            <line x1="6" y1="0" x2="6" y2="80" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="1" />
            <circle cx="6" cy="25" r="2" fill="rgba(99, 102, 241, 0.5)" />
            <circle cx="6" cy="50" r="2" fill="rgba(99, 102, 241, 0.5)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit-h)" />
        <rect width="100%" height="100%" fill="url(#circuit-v)" />
      </svg>
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(120,80,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,80,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
