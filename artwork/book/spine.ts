import { rng, type Book } from "../../domain/catalog";
import type { Ctx, Fonts } from "../primitives/canvas";
import { luminance, shade } from "../primitives/color";
import { grain, ornament } from "../primitives/marks";
import { fitText, surname } from "../primitives/text";

// spine art with x, y at the top left, the title runs top to bottom so laid-flat stacks read left to right
export function drawSpine(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  book: Book,
  F: Fonts,
) {
  const { base, ink, accent } = book;
  const seed = book.id;
  const r = rng(seed + "spine");
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, seed, 0.07);

  const title = book.title.toUpperCase();
  const cx = x + w / 2;
  let titleTop = y + h * 0.16;
  let titleBot = y + h * 0.8;
  let titleColor = ink;
  let titleFont = (s: number) => `600 ${s}px ${F.caps}`;
  let spacing = 0.08;

  const goldRules = (yy: number, col = accent) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, yy, w, Math.max(1, h * 0.004));
    ctx.fillRect(x, yy + h * 0.012, w, Math.max(1, h * 0.0025));
  };

  switch (book.spine) {
    case "cloth": {
      goldRules(y + h * 0.05);
      goldRules(y + h * 0.93);
      ornament(ctx, cx, y + h * 0.12, w * 0.16, accent, 0);
      titleTop = y + h * 0.17;
      titleBot = y + h * 0.84;
      titleFont = (s) => `500 ${s}px ${F.serif}`;
      spacing = 0.04;
      break;
    }
    case "paper": {
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, w, h * 0.12);
      ctx.fillStyle = shade(base, -0.08);
      ctx.fillRect(x, y + h * 0.12, w, h * 0.006);
      titleTop = y + h * 0.17;
      titleBot = y + h * 0.82;
      titleFont = (s) => `500 ${s}px ${F.sans}`;
      spacing = 0.18;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.9, w * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "label": {
      const lc = luminance(base) > 0.5 ? "#1b1712" : shade(base, -0.55);
      ctx.fillStyle = lc;
      ctx.fillRect(x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.56);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, w * 0.035);
      ctx.strokeRect(x + w * 0.17, y + h * 0.215, w * 0.66, h * 0.53);
      goldRules(y + h * 0.06);
      goldRules(y + h * 0.91);
      ornament(ctx, cx, y + h * 0.83, w * 0.14, accent, 2);
      titleTop = y + h * 0.24;
      titleBot = y + h * 0.72;
      titleColor = accent;
      break;
    }
    case "ribbed": {
      // leather with raised bands catching the light
      const ribs = [0.1, 0.24, 0.62, 0.76, 0.9];
      for (const p of ribs) {
        const ry = y + h * p;
        const g = ctx.createLinearGradient(
          0,
          ry - h * 0.012,
          0,
          ry + h * 0.012,
        );
        g.addColorStop(0, shade(base, -0.4));
        g.addColorStop(0.45, shade(base, 0.25));
        g.addColorStop(1, shade(base, -0.5));
        ctx.fillStyle = g;
        ctx.fillRect(x, ry - h * 0.012, w, h * 0.024);
        ctx.fillStyle = accent;
        ctx.fillRect(x, ry - h * 0.016, w, Math.max(1, h * 0.002));
        ctx.fillRect(x, ry + h * 0.015, w, Math.max(1, h * 0.002));
      }
      ctx.fillStyle = "#6b1f18";
      ctx.fillRect(x + w * 0.08, y + h * 0.27, w * 0.84, h * 0.32);
      titleTop = y + h * 0.28;
      titleBot = y + h * 0.58;
      titleColor = accent;
      ornament(ctx, cx, y + h * 0.69, w * 0.15, accent, 1);
      break;
    }
    case "pattern": {
      const band = (y0: number, bh: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y0, w, bh);
        ctx.clip();
        ctx.fillStyle = accent;
        ctx.fillRect(x, y0, w, bh);
        ctx.fillStyle = base;
        const s = Math.max(3, w * 0.28);
        for (let yy = y0 - s; yy < y0 + bh + s; yy += s) {
          for (let xx = x - s; xx < x + w + s; xx += s) {
            ctx.beginPath();
            ctx.moveTo(xx + s / 2, yy);
            ctx.lineTo(xx + s, yy + s / 2);
            ctx.lineTo(xx + s / 2, yy + s);
            ctx.lineTo(xx, yy + s / 2);
            ctx.fill();
          }
        }
        ctx.restore();
      };
      band(y, h * 0.14);
      band(y + h * 0.86, h * 0.14);
      ctx.fillStyle = luminance(base) > 0.6 ? "#f6efdf" : "#f1e7d2";
      ctx.fillRect(x + w * 0.12, y + h * 0.2, w * 0.76, h * 0.6);
      titleTop = y + h * 0.23;
      titleBot = y + h * 0.77;
      titleColor = luminance(base) > 0.6 ? ink : base;
      titleFont = (s) => `italic 600 ${s}px ${F.serif}`;
      spacing = 0;
      break;
    }
  }

  // title rotated 90° clockwise
  const len = titleBot - titleTop;
  ctx.save();
  ctx.translate(cx, (titleTop + titleBot) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = titleColor;
  ctx.textBaseline = "middle";
  const text = book.spine === "pattern" ? book.title : title;
  fitText(
    ctx,
    text,
    0,
    0,
    len,
    Math.min(w * 0.5, h * 0.07),
    titleFont,
    spacing,
  );
  ctx.restore();

  // author sits across a wide spine and along a narrow one
  const au = surname(book.author).toUpperCase();
  ctx.fillStyle =
    book.spine === "pattern"
      ? luminance(base) > 0.6
        ? ink
        : base
      : titleColor;
  ctx.textBaseline = "middle";
  if (book.spine === "cloth" || book.spine === "paper") {
    if (w > h * 0.14) {
      fitText(
        ctx,
        au,
        cx,
        y + (book.spine === "paper" ? h * 0.86 : h * 0.885),
        w * 0.84,
        w * 0.18,
        (s) => `500 ${s}px ${F.sans}`,
        0.1,
      );
    } else {
      ctx.save();
      ctx.translate(cx, y + h * 0.875);
      ctx.rotate(Math.PI / 2);
      fitText(
        ctx,
        au,
        0,
        0,
        h * 0.08,
        w * 0.32,
        (s) => `500 ${s}px ${F.sans}`,
        0.1,
      );
      ctx.restore();
    }
  }

  // headcap wear and cylindrical shading make a flat box read as a rounded spine
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(0.18, "rgba(0,0,0,0.06)");
  g.addColorStop(0.42, "rgba(255,240,210,0.10)");
  g.addColorStop(0.6, "rgba(255,240,210,0.04)");
  g.addColorStop(0.85, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const v = ctx.createLinearGradient(0, y, 0, y + h);
  v.addColorStop(0, "rgba(0,0,0,0.25)");
  v.addColorStop(0.03, "rgba(0,0,0,0)");
  v.addColorStop(0.97, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
  if (r() > 0.5) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x, y + r() * h, w, h * 0.002);
  }
  ctx.restore();
}
