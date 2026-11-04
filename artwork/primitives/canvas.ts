// canvas plumbing shared by every drawing function

// css font-family names, loaded before any text is drawn
export interface Fonts {
  serif: string; // cormorant garamond
  caps: string; // cinzel
  sans: string; // jost
}

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
