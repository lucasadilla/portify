"use client";

import { useEffect, useRef } from "react";

const COLS = 14;
const ROWS = 10;

export function GitGraphBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const draw = () => {
      t += 0.015;
      ctx.fillStyle = "rgba(8, 8, 14, 0.45)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cellW = canvas.width / (COLS + 2);
      const cellH = canvas.height / (ROWS + 2);
      const points: { x: number; y: number; row: number; col: number }[] = [];

      for (let row = 0; row < ROWS; row++) {
        const numDots = 3 + (row % 4);
        for (let i = 0; i < numDots; i++) {
          const col = Math.floor((i / numDots) * (COLS - 1)) + 1;
          points.push({
            x: col * cellW + cellW / 2,
            y: row * cellH + cellH / 2,
            row,
            col,
          });
        }
      }

      // Lines between rows (commit graph branches)
      ctx.strokeStyle = "rgba(120, 80, 255, 0.2)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (b && b.row === a.row + 1) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Commit dots with pulse
      points.forEach((p, i) => {
        const pulse = 0.8 + 0.2 * Math.sin(t + i * 0.5);
        const r = (Math.min(cellW, cellH) * 0.22) * pulse;
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
        gr.addColorStop(0, "rgba(120, 80, 255, 0.55)");
        gr.addColorStop(0.6, "rgba(120, 80, 255, 0.15)");
        gr.addColorStop(1, "transparent");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(120, 80, 255, 0.6)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
      animationId = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-[#08080c]" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
