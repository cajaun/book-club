import type { Book } from "../domain/catalog";
import { makeCanvas, type Fonts } from "./primitives/canvas";
import { drawCover } from "./book/cover";
import { drawBack, drawPages } from "./book/pages";
import { drawSpine } from "./book/spine";

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

// packs every book's spine and front cover into one texture so a whole page of books shares one material
export function buildAtlas(books: Book[], F: Fonts, maxSize = 4096): Atlas {
  // the highest density in px per cm that still fits the texture
  let D = 14;
  let layout: {
    regions: Record<string, BookRegions>;
    height: number;
    pages: Rect;
  } | null = null;
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
    // padding in the base colour stops mipmaps bleeding in neighbours
    for (const r of [R.spine, R.cover, R.back]) {
      ctx.fillStyle = book.base;
      ctx.fillRect(r.x - PAD, r.y - PAD, r.w + PAD * 2, r.h + PAD * 2);
    }
    drawSpine(ctx, R.spine.x, R.spine.y, R.spine.w, R.spine.h, book, F);
    drawCover(ctx, R.cover.x, R.cover.y, R.cover.w, R.cover.h, book, F);
    drawBack(ctx, R.back.x, R.back.y, R.back.w, R.back.h, book);
  }
  ctx.fillStyle = "#e9dfc7";
  ctx.fillRect(
    L.pages.x - PAD,
    L.pages.y - PAD,
    L.pages.w + PAD * 2,
    L.pages.h + PAD * 2,
  );
  drawPages(ctx, L.pages.x, L.pages.y, L.pages.w, L.pages.h);
  return {
    canvas,
    regions: L.regions,
    pages: L.pages,
    size: { w: canvas.width, h: canvas.height },
  };
}

// shelf packing, left to right in rows
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
