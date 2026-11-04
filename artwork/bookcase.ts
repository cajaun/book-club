// wood, back wall and brass plaques for the bookcase

import { rng } from "../domain/catalog";
import { makeCanvas, type Fonts } from "./primitives/canvas";
import { fitText } from "./primitives/text";

// horizontal grain, banded streaks over the base colour with wavy figure lines
export function drawWood(
  w: number,
  h: number,
  seed = "wood",
  base = "#5f3923",
) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < h; i += 1) {
    const t = Math.sin(i * 0.05 + r() * 0.3) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(${20 + t * 30},${10 + t * 14},${4},${0.18 + r() * 0.2})`;
    ctx.fillRect(0, i, w, 1);
  }
  for (let k = 0; k < h / 3; k++) {
    const y0 = r() * h;
    ctx.strokeStyle = r() > 0.5 ? "rgba(20,8,2,0.35)" : "rgba(140,90,55,0.18)";
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    const amp = 2 + r() * 6;
    const f = 0.004 + r() * 0.01;
    const ph = r() * 10;
    for (let x = 0; x <= w; x += 8)
      ctx.lineTo(x, y0 + Math.sin(x * f + ph) * amp);
    ctx.stroke();
  }
  return c;
}

// the same wood turned so the grain runs vertically, like the case's side panels
export function drawWoodVertical(w: number, h: number, seed = "wood") {
  const src = drawWood(h, w, seed);
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.translate(w, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

// dark green tongue and groove planks behind the books
export function drawBackWall(w: number, h: number) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0f1a14";
  ctx.fillRect(0, 0, w, h);
  const r = rng("wall");
  const plank = w / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `rgba(${12 + r() * 8},${26 + r() * 8},${19 + r() * 6},0.6)`;
    ctx.fillRect(i * plank, 0, plank, h);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(i * plank, 0, 2, h);
    ctx.fillStyle = "rgba(90,120,100,0.06)";
    ctx.fillRect(i * plank + 2, 0, 1, h);
  }
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.15})`;
    ctx.fillRect(r() * w, r() * h, 1, 4 + r() * 20);
  }
  return c;
}

// brass label with a highlight under engraved text
export function drawPlaque(text: string, F: Fonts, scale = 1) {
  const w = 512 * scale,
    h = 56 * scale;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#e2c27a");
  g.addColorStop(0.45, "#b88f45");
  g.addColorStop(1, "#7d5a26");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 6 * scale);
  ctx.fill();
  ctx.strokeStyle = "rgba(60,36,10,0.7)";
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(6 * scale, 6 * scale, w - 12 * scale, h - 12 * scale);
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,236,190,0.45)";
  fitText(
    ctx,
    text,
    w / 2,
    h / 2 + 2.5 * scale,
    w * 0.84,
    28 * scale,
    (s) => `600 ${s}px ${F.sans}`,
    0.2,
  );
  ctx.fillStyle = "#241405";
  fitText(
    ctx,
    text,
    w / 2,
    h / 2 + 1 * scale,
    w * 0.84,
    28 * scale,
    (s) => `600 ${s}px ${F.sans}`,
    0.2,
  );
  return c;
}
