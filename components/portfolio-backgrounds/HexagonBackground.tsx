"use client";

export function HexagonBackground() {
  const size = 44;
  const r = size / 2;
  const h = Math.sqrt(3) * r;
  const hexPath = `M ${r} 0 L ${r / 2} ${h / 2} L ${-r / 2} ${h / 2} L ${-r} 0 L ${-r / 2} ${-h / 2} L ${r / 2} ${-h / 2} Z`;
  return (
    <div className="fixed inset-0 -z-10 bg-[#0a0a0f]" aria-hidden>
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.15]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="hex-grid"
            width={r * 3}
            height={h * 2}
            patternUnits="userSpaceOnUse"
          >
            {[0, 1].map((row) =>
              [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => (
                <path
                  key={`${row}-${col}`}
                  d={hexPath}
                  fill="none"
                  stroke="rgba(120, 80, 255, 0.5)"
                  strokeWidth="0.8"
                  transform={`translate(${col * (r * 1.5)}, ${row * h + (col % 2) * h * 0.5})`}
                />
              ))
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex-grid)" />
      </svg>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 80, 255, 0.08), transparent)",
        }}
      />
    </div>
  );
}
