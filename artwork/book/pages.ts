// the parts of a book you only see up close

import { formatYear, rng, type Book } from "../../domain/catalog";
import type { Ctx, Fonts } from "../primitives/canvas";
import { grain, ornament } from "../primitives/marks";
import { fitText, wrapText } from "../primitives/text";

// back board, plain cloth
export function drawBack(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  book: Book,
) {
  ctx.fillStyle = book.base;
  ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, book.id + "back", 0.05);
}

export function drawPages(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seed = "pages",
) {
  // page block seen edge on, fine lines running along v
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

// first page the reader sees when the cover opens
export function drawTitlePage(
  ctx: Ctx,
  w: number,
  h: number,
  book: Book,
  F: Fonts,
) {
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
  fitText(
    ctx,
    "GK   BOOK   CLUB",
    cx,
    h * 0.08,
    w * 0.7,
    2.8 * u,
    (s) => `500 ${s}px ${F.sans}`,
    0.25,
  );
  ctx.fillStyle = red;
  ctx.fillRect(cx - 7 * u, h * 0.105, 14 * u, Math.max(1, u * 0.3));
  ctx.fillStyle = "#1f1712";
  const words = book.title.toUpperCase().split(" ");
  let ty = h * 0.2;
  if (book.title.length > 16 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    fitText(
      ctx,
      words.slice(0, mid).join(" "),
      cx,
      ty - 4 * u,
      w * 0.78,
      8.5 * u,
      (s) => `500 ${s}px ${F.caps}`,
      0.05,
    );
    fitText(
      ctx,
      words.slice(mid).join(" "),
      cx,
      ty + 6 * u,
      w * 0.78,
      8.5 * u,
      (s) => `500 ${s}px ${F.caps}`,
      0.05,
    );
    ty += 8 * u;
  } else {
    fitText(
      ctx,
      book.title.toUpperCase(),
      cx,
      ty,
      w * 0.78,
      9 * u,
      (s) => `500 ${s}px ${F.caps}`,
      0.05,
    );
  }
  ornament(ctx, cx, ty + 8 * u, 2.6 * u, red, 1);
  ctx.fillStyle = "#6a5a48";
  fitText(
    ctx,
    "by",
    cx,
    ty + 13.5 * u,
    w,
    3.4 * u,
    (s) => `italic 500 ${s}px ${F.serif}`,
  );
  ctx.fillStyle = red;
  fitText(
    ctx,
    book.author.toUpperCase(),
    cx,
    ty + 18 * u,
    w * 0.8,
    4 * u,
    (s) => `600 ${s}px ${F.caps}`,
    0.08,
  );
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(cx - 16 * u, ty + 23 * u, 32 * u, Math.max(1, u * 0.2));
  ctx.fillStyle = "#3a2e22";
  ctx.font = `italic 500 ${3.6 * u}px ${F.serif}`;
  wrapText(ctx, book.blurb, cx, ty + 30 * u, w * 0.78, 5 * u);
  // publisher colophon
  ctx.strokeStyle = red;
  ctx.lineWidth = u * 0.35;
  ctx.beginPath();
  ctx.arc(cx, h * 0.86, 3 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = red;
  fitText(
    ctx,
    "GK",
    cx,
    h * 0.862,
    5 * u,
    2.6 * u,
    (s) => `600 ${s}px ${F.caps}`,
  );
  ctx.fillStyle = "#4a3a2a";
  fitText(
    ctx,
    `FIRST PUBLISHED ${formatYear(book.year)}`,
    cx,
    h * 0.915,
    w * 0.7,
    2.2 * u,
    (s) => `600 ${s}px ${F.sans}`,
    0.25,
  );
  ctx.fillStyle = "#8a7a64";
  fitText(
    ctx,
    `${book.pages} PAGES  ·  COLLECTOR'S EDITION`,
    cx,
    h * 0.945,
    w * 0.7,
    2 * u,
    (s) => `500 ${s}px ${F.sans}`,
    0.25,
  );
}

export function drawEndpaper(ctx: Ctx, w: number, h: number, book: Book) {
  // marbled waves like the endpaper in the reference reader view
  const cols = [
    "#c2953e",
    "#2a2340",
    "#a8432c",
    "#e7dcbf",
    book.accent,
    "#1d1a17",
  ];
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
