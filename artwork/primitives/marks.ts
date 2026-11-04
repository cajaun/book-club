// small decorative marks shared by spines, covers and pages

import { rng } from "../../domain/catalog";
import type { Ctx } from "./canvas";

// speckles of light and dark that read as paper or cloth texture
export function grain(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  alpha = 0.06,
) {
  const r = rng(seed + "grain");
  const n = Math.min(4000, (w * h) / 18);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle =
      r() > 0.5
        ? `rgba(255,255,255,${alpha * r()})`
        : `rgba(0,0,0,${alpha * 1.6 * r()})`;
    ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 1.5, 1);
  }
}

// kind picks a diamond with dots, a two-leaf fleuron or a star
export function ornament(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  color: string,
  kind = 0,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.translate(x, y);
  if (kind % 3 === 0) {
    // diamond with dots
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.6, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s * 1.1, 0, s * 0.18, 0, Math.PI * 2);
    ctx.arc(s * 1.1, 0, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind % 3 === 1) {
    // fleuron: two leaves
    ctx.lineWidth = Math.max(1, s * 0.14);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(dir * s * 0.9, -s * 0.9, dir * s * 1.4, 0);
      ctx.quadraticCurveTo(dir * s * 0.9, s * 0.3, 0, 0);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, s * 0.35, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // star
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? s * 0.4 : s;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
