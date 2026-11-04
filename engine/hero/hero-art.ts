// close-up artwork per book, cached by density

import { BOOK_BY_ID } from "../../domain/catalog";
import {
  drawBack,
  drawCover,
  drawEndpaper,
  drawPages,
  drawSpine,
  drawTitlePage,
  makeCanvas,
  type Fonts,
} from "../../artwork";

export interface HeroArt {
  cover: HTMLCanvasElement;
  spine: HTMLCanvasElement;
  back: HTMLCanvasElement;
  pages: HTMLCanvasElement;
  title: HTMLCanvasElement;
  end: HTMLCanvasElement;
}

export const ART_FAST = 14; // px per cm, the shelf atlas density, quick enough to draw on tap
export const ART_SHARP = 40; // px per cm, swapped in once the book has landed
export const HERO_BOARD = 0.28; // cover board thickness in cm

const CACHE_SIZE = 16;

export class HeroArtCache {
  private art = new Map<string, HeroArt>();

  constructor(private fonts: Fonts) {}

  get(id: string, D = ART_FAST): HeroArt {
    const key = `${id}@${D}`;
    const hit = this.art.get(key);
    if (hit) return hit;
    const b = BOOK_BY_ID[id];
    const F = this.fonts;
    const cover = makeCanvas(b.d * D, b.h * D);
    drawCover(cover.getContext("2d")!, 0, 0, cover.width, cover.height, b, F);
    const spine = makeCanvas(Math.max(8, b.t * D), b.h * D);
    drawSpine(spine.getContext("2d")!, 0, 0, spine.width, spine.height, b, F);
    const back = makeCanvas(64, 64);
    drawBack(back.getContext("2d")!, 0, 0, 64, 64, b);
    const pages = makeCanvas(256, 256);
    drawPages(pages.getContext("2d")!, 0, 0, 256, 256, b.id);
    // the page block sits flush with the boards so the close-up keeps the shelf copy's silhouette
    const title = makeCanvas((b.d - HERO_BOARD) * D, b.h * D);
    drawTitlePage(title.getContext("2d")!, title.width, title.height, b, F);
    const ew = D >= ART_SHARP ? 384 : 128;
    const end = makeCanvas(ew, ew * 1.5);
    drawEndpaper(end.getContext("2d")!, ew, ew * 1.5, b);
    const art = { cover, spine, back, pages, title, end };
    this.art.set(key, art);
    // oldest first, a map keeps insertion order
    if (this.art.size > CACHE_SIZE)
      this.art.delete(this.art.keys().next().value!);
    return art;
  }
}
