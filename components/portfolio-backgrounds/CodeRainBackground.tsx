"use client";

import { useEffect, useRef } from "react";

const CHARS = "const function return {} [] => async await type interface export";
const FALL_SPEED = 1.2;
const COLUMN_COUNT = 28;

export function CodeRainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = CHARS.split(" ");
    const columns: { y: number; speed: number; chars: string[] }[] = [];
    for (let i = 0; i < COLUMN_COUNT; i++) {
      columns.push({
        y: Math.random() * -20,
        speed: FALL_SPEED + Math.random() * 0.8,
        chars: Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => chars[Math.floor(Math.random() * chars.length)]),
      });
    }

    let animationId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const draw = () => {
      ctx.fillStyle = "rgba(8, 8, 12, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const colWidth = canvas.width / COLUMN_COUNT;
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillStyle = "rgba(34, 197, 94, 0.35)";

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const x = i * colWidth + colWidth / 2;
        col.y += col.speed;
        if (col.y > canvas.height + 50) col.y = -30;
        col.chars.forEach((c, j) => {
          ctx.globalAlpha = 1 - j * 0.25;
          ctx.fillText(c, x, col.y + j * 22);
        });
        ctx.globalAlpha = 1;
      }
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
