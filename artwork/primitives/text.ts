import type { Ctx } from "./canvas";

// draws text centred on x, y and shrinks the font until it fits maxW
export function fitText(
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
    // canvas has no tracking so spaced caps go one glyph at a time
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

// word-wraps centred text and returns the y below the last line
export function wrapText(ctx: Ctx, text: string, x: number, y: number, maxW: number, lh: number) {
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

export function surname(author: string) {
  const parts = author.replace(/&.*/, "").trim().split(" ");
  return parts[parts.length - 1];
}
