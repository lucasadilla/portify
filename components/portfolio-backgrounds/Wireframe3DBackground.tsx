"use client";

import { useEffect, useRef } from "react";

export function Wireframe3DBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const shapes: { x: number; y: number; z: number; r: number; rotX: number; rotY: number; vRotX: number; vRotY: number }[] = [];
    for (let i = 0; i < 8; i++) {
      shapes.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 2,
        r: 0.08 + Math.random() * 0.06,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        vRotX: (Math.random() - 0.5) * 0.008,
        vRotY: (Math.random() - 0.5) * 0.008,
      });
    }

    let animationId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const project = (x: number, y: number, z: number) => {
      const scale = 1.2 / (1.5 + z);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      return { x: cx + x * scale * Math.min(canvas.width, canvas.height) * 0.4, y: cy + y * scale * Math.min(canvas.width, canvas.height) * 0.4, scale };
    };

    const drawCube = (cx: number, cy: number, size: number, rotX: number, rotY: number) => {
      const s = size / 2;
      const corners = [
        [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
        [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
      ];
      const rot = (x: number, y: number, z: number) => {
        let [xx, yy, zz] = [x, y, z];
        xx = x * Math.cos(rotY) - z * Math.sin(rotY);
        zz = x * Math.sin(rotY) + z * Math.cos(rotY);
        [x, y, z] = [xx, yy, zz];
        yy = y * Math.cos(rotX) - z * Math.sin(rotX);
        zz = y * Math.sin(rotX) + z * Math.cos(rotX);
        return [xx, yy, zz];
      };
      const projected = corners.map(([x, y, z]) => {
        const [xx, yy, zz] = rot(x, y, z);
        return project(cx + xx, cy + yy, 1 + zz);
      });
      const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      ctx.strokeStyle = "rgba(120, 80, 255, 0.35)";
      ctx.lineWidth = 1;
      edges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(projected[i].x, projected[i].y);
        ctx.lineTo(projected[j].x, projected[j].y);
        ctx.stroke();
      });
    };

    const draw = () => {
      ctx.fillStyle = "rgba(6, 6, 10, 0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      shapes.forEach((sh) => {
        sh.rotX += sh.vRotX;
        sh.rotY += sh.vRotY;
        const p = project(sh.x, sh.y, sh.z);
        drawCube(p.x, p.y, sh.r * Math.min(canvas.width, canvas.height), sh.rotX, sh.rotY);
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
    <div className="fixed inset-0 -z-10 bg-[#06060a]" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
