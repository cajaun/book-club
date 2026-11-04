import type { Book } from "../../domain/catalog";
import type { Ctx, Fonts } from "../primitives/canvas";
import { shade } from "../primitives/color";
import { grain, ornament } from "../primitives/marks";
import { fitText } from "../primitives/text";

// front cover artwork, one layout per cover style
export function drawCover(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  book: Book,
  F: Fonts,
) {
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

  const titleBlock = (
    ty: number,
    color: string,
    maxW = w * 0.74,
    size = 9 * u,
    italic = false,
  ) => {
    ctx.fillStyle = color;
    const words = title.toUpperCase().split(" ");
    // split long titles into two balanced lines
    if (words.length > 2 && title.length > 14) {
      const mid = Math.ceil(words.length / 2);
      fitText(
        ctx,
        words.slice(0, mid).join(" "),
        cx,
        ty - size * 0.6,
        maxW,
        size,
        (s) => `600 ${s}px ${F.caps}`,
        0.06,
      );
      fitText(
        ctx,
        words.slice(mid).join(" "),
        cx,
        ty + size * 0.6,
        maxW,
        size,
        (s) => `600 ${s}px ${F.caps}`,
        0.06,
      );
    } else if (italic) {
      fitText(
        ctx,
        title,
        cx,
        ty,
        maxW,
        size * 1.3,
        (s) => `italic 600 ${s}px ${F.serif}`,
      );
    } else {
      fitText(
        ctx,
        title.toUpperCase(),
        cx,
        ty,
        maxW,
        size,
        (s) => `600 ${s}px ${F.caps}`,
        0.08,
      );
    }
  };
  const authorLine = (ay: number, color: string, size = 3.6 * u) => {
    ctx.fillStyle = color;
    fitText(
      ctx,
      book.author.toUpperCase(),
      cx,
      ay,
      w * 0.7,
      size,
      (s) => `500 ${s}px ${F.sans}`,
      0.22,
    );
  };

  switch (book.cover) {
    case "frame": {
      // gold frame, label box and sunrise rays at the foot like the dracula cover
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.6;
      ctx.strokeRect(x + 6 * u, y + 5 * u, w - 12 * u, h - 10 * u);
      ctx.lineWidth = u * 0.3;
      ctx.strokeRect(x + 8 * u, y + 7 * u, w - 16 * u, h - 14 * u);
      // rays fan out from the bottom centre
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
      ctx.beginPath();
      ctx.moveTo(x + 8 * u, y + 7 * u);
      ctx.lineTo(x + 22 * u, y + 30 * u);
      ctx.moveTo(x + w - 8 * u, y + 7 * u);
      ctx.lineTo(x + w - 22 * u, y + 30 * u);
      ctx.stroke();
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
      // title at the top left over a red sun like the frankenstein cover
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
        ctx.lineTo(
          sx + Math.cos(a) * sr * (i % 2 ? 1.7 : 2),
          sy + Math.sin(a) * sr * (i % 2 ? 1.7 : 2),
        );
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
      ctx.strokeRect(
        cx - lw / 2 + 2 * u,
        y + h * 0.3 + 2 * u,
        lw - 4 * u,
        lh - 4 * u,
      );
      ctx.fillStyle = base;
      fitText(
        ctx,
        title,
        cx,
        y + h * 0.3 + lh * 0.42,
        lw * 0.82,
        10 * u,
        (s) => `italic 600 ${s}px ${F.serif}`,
      );
      fitText(
        ctx,
        book.author.toUpperCase(),
        cx,
        y + h * 0.3 + lh * 0.75,
        lw * 0.8,
        3 * u,
        (s) => `500 ${s}px ${F.sans}`,
        0.2,
      );
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
      fitText(
        ctx,
        title,
        cx,
        y + h * 0.32 + lh * 0.42,
        lw * 0.85,
        11 * u,
        (s) => `italic 500 ${s}px ${F.serif}`,
      );
      fitText(
        ctx,
        book.author.toUpperCase(),
        cx,
        y + h * 0.32 + lh * 0.78,
        lw * 0.85,
        3 * u,
        (s) => `500 ${s}px ${F.sans}`,
        0.2,
      );
      break;
    }
    case "waves": {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.1 * u;
      for (let yy = y + h * 0.08; yy < y + h * 0.58; yy += 5 * u) {
        ctx.beginPath();
        for (let xx = 0; xx <= w; xx += 2 * u)
          ctx.lineTo(x + xx, yy + Math.sin(xx / (5 * u)) * 1.6 * u);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f6f1ea";
      ctx.fillRect(x, y + h * 0.66, w, h * 0.34);
      ctx.fillStyle = ink;
      fitText(
        ctx,
        title,
        cx,
        y + h * 0.77,
        w * 0.8,
        10 * u,
        (s) => `600 ${s}px ${F.serif}`,
      );
      fitText(
        ctx,
        book.author.toUpperCase(),
        cx,
        y + h * 0.86,
        w * 0.8,
        3 * u,
        (s) => `500 ${s}px ${F.sans}`,
        0.2,
      );
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
      ctx.fillStyle = shade(base, -0.25);
      ctx.fillRect(x + 8 * u, y + h * 0.2, w - 16 * u, h * 0.36);
      ctx.strokeStyle = accent;
      ctx.lineWidth = u * 0.5;
      ctx.strokeRect(
        x + 10 * u,
        y + h * 0.2 + 2 * u,
        w - 20 * u,
        h * 0.36 - 4 * u,
      );
      titleBlock(y + h * 0.33, ink, w * 0.66, 9 * u);
      ornament(ctx, cx, y + h * 0.45, 2.5 * u, accent, 1);
      authorLine(y + h * 0.82, ink, 3 * u);
    }
  }

  // hinge groove and soft board shading
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
