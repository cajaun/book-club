// All artwork is drawn procedurally with Canvas2D (the browser's own
// Skia-backed 2D API), so the shelf ships zero image bytes and any book added
// to the manifest gets a matching spine and cover automatically.

import type { Book } from "./books";
import { rng } from "./books";

export interface Fonts {
  serif: string; // Cormorant Garamond
  caps: string; // Cinzel
  sans: string; // Jost
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---------------------------------------------------------------- helpers

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Draw text centred at (x,y), shrinking the font so it fits maxW. */
function fitText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  font: (s: number) => string,
  spacing = 0,
) {
  let s = size;
  ctx.font = font(s);
  const measure = () => ctx.measureText(text).width + spacing * s * (text.length - 1);
  let w = measure();
  if (w > maxW) {
    s = Math.max(2, (s * maxW) / w);
    ctx.font = font(s);
    w = measure();
  }
  if (spacing) {
    // manual letter-spacing for tracked caps
    let cx = x - w / 2;
    ctx.textAlign = "left";
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing * s;
    }
    ctx.textAlign = "center";
  } else {
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
  }
  return s;
}

/** Word-wrap centred text. Returns the y after the last line. */
function wrapText(ctx: Ctx, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  ctx.textAlign = "center";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

function grain(ctx: Ctx, x: number, y: number, w: number, h: number, seed: string, alpha = 0.06) {
  const r = rng(seed + "grain");
  const n = Math.min(4000, (w * h) / 18);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha * r()})` : `rgba(0,0,0,${alpha * 1.6 * r()})`;
    ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 1.5, 1);
  }
}

function ornament(ctx: Ctx, x: number, y: number, s: number, color: string, kind = 0) {
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

function surname(author: string) {
  const parts = author.replace(/&.*/, "").trim().split(" ");
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------- spines

/**
 * Spine artwork. (x,y) top-left in px, w = thickness, h = height.
 * Title runs top-to-bottom (rotated 90° clockwise), the English convention,
 * which is what makes laid-flat stacks read left-to-right.
 */
export function drawSpine(ctx: Ctx, x: number, y: number, w: number, h: number, book: Book, F: Fonts) {
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
      // leather with raised bands
      const ribs = [0.1, 0.24, 0.62, 0.76, 0.9];
      for (const p of ribs) {
        const ry = y + h * p;
        const g = ctx.createLinearGradient(0, ry - h * 0.012, 0, ry + h * 0.012);
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

  // title, rotated 90° clockwise
  const len = titleBot - titleTop;
  ctx.save();
  ctx.translate(cx, (titleTop + titleBot) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = titleColor;
  ctx.textBaseline = "middle";
  const text = book.spine === "pattern" ? book.title : title;
  fitText(ctx, text, 0, 0, len, Math.min(w * 0.5, h * 0.07), titleFont, spacing);
  ctx.restore();

  // author: horizontal when the spine is wide enough, otherwise rotated
  const au = surname(book.author).toUpperCase();
  ctx.fillStyle = book.spine === "pattern" ? (luminance(base) > 0.6 ? ink : base) : titleColor;
  ctx.textBaseline = "middle";
  if (book.spine === "cloth" || book.spine === "paper") {
    if (w > h * 0.14) {
      fitText(ctx, au, cx, y + (book.spine === "paper" ? h * 0.86 : h * 0.885), w * 0.84, w * 0.18, (s) => `500 ${s}px ${F.sans}`, 0.1);
    } else {
      ctx.save();
      ctx.translate(cx, y + h * 0.875);
      ctx.rotate(Math.PI / 2);
      fitText(ctx, au, 0, 0, h * 0.08, w * 0.32, (s) => `500 ${s}px ${F.sans}`, 0.1);
      ctx.restore();
    }
  }

  // headcap wear + cylindrical shading so flat boxes read as rounded spines
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

// ---------------------------------------------------------------- covers

export function drawCover(ctx: Ctx, x: number, y: number, w: number, h: number, book: Book, F: Fonts) {
  const { base, ink, accent } = book;
  const u = w / 100;
  const cx = x + w / 2;
  const title = book.title;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, book.id + "cov", 0.05);
  ctx.textBaseline = "middle";

  const titleBlock = (ty: number, color: string, maxW = w * 0.74, size = 9 * u, italic = false) => {
    ctx.fillStyle = color;
    const words = title.toUpperCase().split(" ");
    // split long titles into two balanced lines
    if (words.length > 2 && title.length > 14) {
      const mid = Math.ceil(words.length / 2);
      fitText(ctx, words.slice(0, mid).join(" "), cx, ty - size * 0.6, maxW, size, (s) => `600 ${s}px ${F.caps}`, 0.06);
      fitText(ctx, words.slice(mid).join(" "), cx, ty + size * 0.6, maxW, size, (s) => `600 ${s}px ${F.caps}`, 0.06);
    } else if (italic) {
      fitText(ctx, title, cx, ty, maxW, size * 1.3, (s) => `italic 600 ${s}px ${F.serif}`);
    } else {
      fitText(ctx, title.toUpperCase(), cx, ty, maxW, size, (s) => `600 ${s}px ${F.caps}`, 0.08);
    }
  };
  const authorLine = (ay: number, color: string, size = 3.6 * u) => {
    ctx.fillStyle = color;
    fitText(ctx, book.author.toUpperCase(), cx, ay, w * 0.7, size, (s) => `500 ${s}px ${F.sans}`, 0.22);
  };

  switch (book.cover) {
    case "frame": {
      // Dracula: gold frame, label box, sunrise rays at the foot
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.6;
      ctx.strokeRect(x + 6 * u, y + 5 * u, w - 12 * u, h - 10 * u);
      ctx.lineWidth = u * 0.3;
      ctx.strokeRect(x + 8 * u, y + 7 * u, w - 16 * u, h - 14 * u);
      // rays from bottom centre
      const ox = cx,
        oy = y + h - 9 * u;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 8 * u, y + 7 * u, w - 16 * u, h - 14 * u);
      ctx.clip();
      ctx.lineWidth = u * 0.28;
      for (let i = 0; i <= 18; i++) {
        const a = Math.PI + (i / 18) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * w, oy + Math.sin(a) * w);
        ctx.stroke();
      }
      for (const rr of [8, 15, 23]) {
        ctx.beginPath();
        ctx.arc(ox, oy, rr * u, Math.PI, 0);
        ctx.stroke();
      }
      ctx.restore();
      // corner diagonals
      ctx.beginPath();
      ctx.moveTo(x + 8 * u, y + 7 * u);
      ctx.lineTo(x + 22 * u, y + 30 * u);
      ctx.moveTo(x + w - 8 * u, y + 7 * u);
      ctx.lineTo(x + w - 22 * u, y + 30 * u);
      ctx.stroke();
      // label
      const ly = y + h * 0.22,
        lh = h * 0.2;
      ctx.fillStyle = shade(base, -0.35);
      ctx.beginPath();
      ctx.roundRect(x + 16 * u, ly, w - 32 * u, lh, 2 * u);
      ctx.fill();
      ctx.lineWidth = u * 0.5;
      ctx.stroke();
      titleBlock(ly + lh * 0.46, ink, w - 40 * u, 9 * u);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(cx, ly + lh + 4 * u);
      ctx.lineTo(cx + 1.6 * u, ly + lh + 6.5 * u);
      ctx.lineTo(cx, ly + lh + 9 * u);
      ctx.lineTo(cx - 1.6 * u, ly + lh + 6.5 * u);
      ctx.fill();
      authorLine(ly + lh + 13 * u, shade(accent, -0.15), 3 * u);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(ox, oy, 1.6 * u, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sunburst": {
      // Frankenstein: title top-left, red sun
      ctx.fillStyle = ink;
      ctx.textAlign = "left";
      ctx.font = `700 ${12 * u}px ${F.serif}`;
      let s = 12 * u;
      while (ctx.measureText(title).width > w * 0.86 && s > 4) {
        s *= 0.95;
        ctx.font = `700 ${s}px ${F.serif}`;
      }
      ctx.fillText(title, x + 6 * u, y + 11 * u);
      ctx.font = `500 ${3.4 * u}px ${F.sans}`;
      ctx.fillText(book.author.toUpperCase(), x + 6 * u, y + 20 * u);
      const sx = x + w * 0.36,
        sy = y + h * 0.56,
        sr = w * 0.16;
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.9;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * sr * 1.25, sy + Math.sin(a) * sr * 1.25);
        ctx.lineTo(sx + Math.cos(a) * sr * (i % 2 ? 1.7 : 2), sy + Math.sin(a) * sr * (i % 2 ? 1.7 : 2));
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "center";
      break;
    }
    case "stripes": {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.2 * u;
      for (let i = -h; i < w + h; i += 8 * u) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i - h, y + h);
        ctx.stroke();
      }
      ctx.restore();
      const lw = w * 0.62,
        lh = h * 0.26;
      ctx.fillStyle = "#f5ecdc";
      ctx.fillRect(cx - lw / 2, y + h * 0.3, lw, lh);
      ctx.strokeStyle = base;
      ctx.lineWidth = u * 0.5;
      ctx.strokeRect(cx - lw / 2 + 2 * u, y + h * 0.3 + 2 * u, lw - 4 * u, lh - 4 * u);
      ctx.fillStyle = base;
      fitText(ctx, title, cx, y + h * 0.3 + lh * 0.42, lw * 0.82, 10 * u, (s) => `italic 600 ${s}px ${F.serif}`);
      fitText(ctx, book.author.toUpperCase(), cx, y + h * 0.3 + lh * 0.75, lw * 0.8, 3 * u, (s) => `500 ${s}px ${F.sans}`, 0.2);
      break;
    }
    case "dots": {
      ctx.fillStyle = accent;
      const s = 7 * u;
      for (let yy = 0, row = 0; yy < h + s; yy += s * 0.8, row++)
        for (let xx = row % 2 ? s / 2 : 0; xx < w + s; xx += s) {
          ctx.beginPath();
          ctx.arc(x + xx, y + yy, 1.4 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      const lw = w * 0.66,
        lh = h * 0.18;
      ctx.fillStyle = "#f7f3e6";
      ctx.fillRect(cx - lw / 2, y + h * 0.32, lw, lh);
      ctx.fillStyle = ink;
      fitText(ctx, title, cx, y + h * 0.32 + lh * 0.42, lw * 0.85, 11 * u, (s) => `italic 500 ${s}px ${F.serif}`);
      fitText(ctx, book.author.toUpperCase(), cx, y + h * 0.32 + lh * 0.78, lw * 0.85, 3 * u, (s) => `500 ${s}px ${F.sans}`, 0.2);
      break;
    }
    case "waves": {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.1 * u;
      for (let yy = y + h * 0.08; yy < y + h * 0.58; yy += 5 * u) {
        ctx.beginPath();
        for (let xx = 0; xx <= w; xx += 2 * u) ctx.lineTo(x + xx, yy + Math.sin(xx / (5 * u)) * 1.6 * u);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f6f1ea";
      ctx.fillRect(x, y + h * 0.66, w, h * 0.34);
      ctx.fillStyle = ink;
      fitText(ctx, title, cx, y + h * 0.77, w * 0.8, 10 * u, (s) => `600 ${s}px ${F.serif}`);
      fitText(ctx, book.author.toUpperCase(), cx, y + h * 0.86, w * 0.8, 3 * u, (s) => `500 ${s}px ${F.sans}`, 0.2);
      break;
    }
    case "emblem": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.4;
      ctx.strokeRect(x + 5 * u, y + 4 * u, w - 10 * u, h - 8 * u);
      titleBlock(y + h * 0.17, ink, w * 0.78, 10 * u);
      ornament(ctx, cx, y + h * 0.3, 3 * u, accent, 1);
      authorLine(y + h * 0.37, accent, 3 * u);
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.65, 13 * u, 0, Math.PI * 2);
      ctx.lineWidth = u * 0.6;
      ctx.stroke();
      ornament(ctx, cx, y + h * 0.65, 6 * u, accent, 2);
      break;
    }
    case "arch": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.5;
      for (let i = 0; i < 4; i++) {
        const ww = w - (14 + i * 7) * u;
        ctx.beginPath();
        ctx.moveTo(cx - ww / 2, y + h - 6 * u);
        ctx.lineTo(cx - ww / 2, y + h * 0.42);
        ctx.arc(cx, y + h * 0.42, ww / 2, Math.PI, 0);
        ctx.lineTo(cx + ww / 2, y + h - 6 * u);
        ctx.stroke();
      }
      titleBlock(y + h * 0.5, ink, w * 0.6, 8 * u);
      ornament(ctx, cx, y + h * 0.62, 2.5 * u, accent, 0);
      authorLine(y + h * 0.7, accent, 2.8 * u);
      break;
    }
    default: {
      // panel
      ctx.fillStyle = shade(base, -0.25);
      ctx.fillRect(x + 8 * u, y + h * 0.2, w - 16 * u, h * 0.36);
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.5;
      ctx.strokeRect(x + 10 * u, y + h * 0.2 + 2 * u, w - 20 * u, h * 0.36 - 4 * u);
      titleBlock(y + h * 0.33, ink, w * 0.66, 9 * u);
      ornament(ctx, cx, y + h * 0.45, 2.5 * u, accent, 1);
      authorLine(y + h * 0.82, ink, 3 * u);
    }
  }

  // hinge groove + soft board shading
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(0,0,0,0.35)");
  g.addColorStop(0.035, "rgba(0,0,0,0.05)");
  g.addColorStop(0.05, "rgba(255,255,255,0.06)");
  g.addColorStop(0.07, "rgba(0,0,0,0)");
  g.addColorStop(0.97, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function drawBack(ctx: Ctx, x: number, y: number, w: number, h: number, book: Book) {
  ctx.fillStyle = book.base;
  ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, book.id + "back", 0.05);
}

export function drawPages(ctx: Ctx, x: number, y: number, w: number, h: number, seed = "pages") {
  // page block seen edge-on: fine lines running along v
  ctx.fillStyle = "#e9dfc7";
  ctx.fillRect(x, y, w, h);
  const r = rng(seed);
  for (let i = 0; i < w; i += 1) {
    ctx.fillStyle = `rgba(90,70,40,${0.04 + r() * 0.1})`;
    ctx.fillRect(x + i, y, 1, h);
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(120,90,50,0.25)");
  g.addColorStop(0.08, "rgba(0,0,0,0)");
  g.addColorStop(0.92, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(120,90,50,0.25)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// ---------------------------------------------------------------- hero-only art

export function drawTitlePage(ctx: Ctx, w: number, h: number, book: Book, F: Fonts) {
  const u = w / 100;
  const cx = w / 2;
  const red = "#a3262a";
  ctx.fillStyle = "#e7dcbf";
  ctx.fillRect(0, 0, w, h);
  grain(ctx, 0, 0, w, h, book.id + "tp", 0.04);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(80,50,20,0.28)");
  g.addColorStop(0.06, "rgba(80,50,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#4a3a2a";
  fitText(ctx, "GK   BOOK   CLUB", cx, h * 0.08, w * 0.7, 2.8 * u, (s) => `500 ${s}px ${F.sans}`, 0.25);
  ctx.fillStyle = red;
  ctx.fillRect(cx - 7 * u, h * 0.105, 14 * u, Math.max(1, u * 0.3));
  ctx.fillStyle = "#1f1712";
  const words = book.title.toUpperCase().split(" ");
  let ty = h * 0.2;
  if (book.title.length > 16 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    fitText(ctx, words.slice(0, mid).join(" "), cx, ty - 4 * u, w * 0.78, 8.5 * u, (s) => `500 ${s}px ${F.caps}`, 0.05);
    fitText(ctx, words.slice(mid).join(" "), cx, ty + 6 * u, w * 0.78, 8.5 * u, (s) => `500 ${s}px ${F.caps}`, 0.05);
    ty += 8 * u;
  } else {
    fitText(ctx, book.title.toUpperCase(), cx, ty, w * 0.78, 9 * u, (s) => `500 ${s}px ${F.caps}`, 0.05);
  }
  ornament(ctx, cx, ty + 8 * u, 2.6 * u, red, 1);
  ctx.fillStyle = "#6a5a48";
  fitText(ctx, "by", cx, ty + 13.5 * u, w, 3.4 * u, (s) => `italic 500 ${s}px ${F.serif}`);
  ctx.fillStyle = red;
  fitText(ctx, book.author.toUpperCase(), cx, ty + 18 * u, w * 0.8, 4 * u, (s) => `600 ${s}px ${F.caps}`, 0.08);
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(cx - 16 * u, ty + 23 * u, 32 * u, Math.max(1, u * 0.2));
  ctx.fillStyle = "#3a2e22";
  ctx.font = `italic 500 ${3.6 * u}px ${F.serif}`;
  wrapText(ctx, book.blurb, cx, ty + 30 * u, w * 0.78, 5 * u);
  // colophon
  ctx.strokeStyle = red;
  ctx.lineWidth = u * 0.35;
  ctx.beginPath();
  ctx.arc(cx, h * 0.86, 3 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = red;
  fitText(ctx, "GK", cx, h * 0.862, 5 * u, 2.6 * u, (s) => `600 ${s}px ${F.caps}`);
  ctx.fillStyle = "#4a3a2a";
  fitText(ctx, `FIRST PUBLISHED ${book.year < 0 ? -book.year + " BC" : book.year}`, cx, h * 0.915, w * 0.7, 2.2 * u, (s) => `600 ${s}px ${F.sans}`, 0.25);
  ctx.fillStyle = "#8a7a64";
  fitText(ctx, `${book.pages} PAGES  ·  COLLECTOR'S EDITION`, cx, h * 0.945, w * 0.7, 2 * u, (s) => `500 ${s}px ${F.sans}`, 0.25);
}

export function drawEndpaper(ctx: Ctx, w: number, h: number, book: Book) {
  // marbled wave endpaper, as in the reference reader view
  const cols = ["#c2953e", "#2a2340", "#a8432c", "#e7dcbf", book.accent, "#1d1a17"];
  ctx.fillStyle = "#e7dcbf";
  ctx.fillRect(0, 0, w, h);
  const step = w / 22;
  for (let i = -2; i < 26; i++) {
    ctx.strokeStyle = cols[((i % cols.length) + cols.length) % cols.length];
    ctx.lineWidth = step * 0.55;
    ctx.beginPath();
    for (let yy = 0; yy <= h; yy += step * 0.25) {
      ctx.lineTo(i * step + Math.sin(yy / (step * 1.1)) * step * 0.9, yy);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- furniture

export function drawWood(w: number, h: number, seed = "wood", base = "#5f3923") {
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
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * f + ph) * amp);
    ctx.stroke();
  }
  return c;
}

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
  fitText(ctx, text, w / 2, h / 2 + 2.5 * scale, w * 0.84, 28 * scale, (s) => `600 ${s}px ${F.sans}`, 0.2);
  ctx.fillStyle = "#24140595".slice(0, 7);
  fitText(ctx, text, w / 2, h / 2 + 1 * scale, w * 0.84, 28 * scale, (s) => `600 ${s}px ${F.sans}`, 0.2);
  return c;
}

// ---------------------------------------------------------------- atlas

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface BookRegions {
  spine: Rect;
  cover: Rect;
  back: Rect;
}
export interface Atlas {
  canvas: HTMLCanvasElement;
  regions: Record<string, BookRegions>;
  pages: Rect;
  size: { w: number; h: number };
}

const PAD = 4;

/**
 * Packs every book's spine + front cover into one texture so the whole
 * shelf renders with a single material.
 */
export function buildAtlas(books: Book[], F: Fonts, maxSize = 4096): Atlas {
  // pick the highest density (px per cm) that fits
  let D = 14;
  let layout: { regions: Record<string, BookRegions>; height: number; pages: Rect } | null = null;
  while (D >= 6) {
    layout = pack(books, D, maxSize);
    if (layout.height <= maxSize) break;
    D -= 1;
  }
  const L = layout!;
  const canvas = makeCanvas(maxSize, L.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const book of books) {
    const R = L.regions[book.id];
    // bleed: fill a padded rect with the base colour first
    for (const r of [R.spine, R.cover, R.back]) {
      ctx.fillStyle = book.base;
      ctx.fillRect(r.x - PAD, r.y - PAD, r.w + PAD * 2, r.h + PAD * 2);
    }
    drawSpine(ctx, R.spine.x, R.spine.y, R.spine.w, R.spine.h, book, F);
    drawCover(ctx, R.cover.x, R.cover.y, R.cover.w, R.cover.h, book, F);
    drawBack(ctx, R.back.x, R.back.y, R.back.w, R.back.h, book);
  }
  ctx.fillStyle = "#e9dfc7";
  ctx.fillRect(L.pages.x - PAD, L.pages.y - PAD, L.pages.w + PAD * 2, L.pages.h + PAD * 2);
  drawPages(ctx, L.pages.x, L.pages.y, L.pages.w, L.pages.h);
  return { canvas, regions: L.regions, pages: L.pages, size: { w: canvas.width, h: canvas.height } };
}

function pack(books: Book[], D: number, W: number) {
  const regions: Record<string, BookRegions> = {};
  let x = PAD,
    y = PAD,
    rowH = 0;
  const place = (w: number, h: number): Rect => {
    w = Math.ceil(w);
    h = Math.ceil(h);
    if (x + w + PAD > W) {
      x = PAD;
      y += rowH + PAD * 2;
      rowH = 0;
    }
    const r = { x, y, w, h };
    x += w + PAD * 2;
    rowH = Math.max(rowH, h);
    return r;
  };
  for (const b of books) {
    const spine = place(b.t * D, b.h * D);
    const cover = place(b.d * D, b.h * D);
    const back = place(24, 24);
    regions[b.id] = { spine, cover, back };
  }
  const pages = place(128, 128);
  return { regions, pages, height: y + rowH + PAD };
}
