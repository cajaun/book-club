// sizes the single bookcase column to the screen

import { CASE, interiorTop } from "./dimensions";

export interface Frame {
  bayW: number; // interior width of the column
  crown: number; // height of the header board
  roomW?: number; // desktop only, the full visible width with wood panelling either side
}

let current: Frame = { bayW: CASE.W, crown: 30 };
export const frame = () => current;
export const setFrame = (f: Frame) => {
  current = f;
};

// fixed zoom with no pinch, five shelves end up taller than the screen so the page scrolls
export const PX_PER_CM = { phone: 5.2, desktop: 6.2 };
const CROWN = 26;

export function fitFrame(w: number, h: number): Frame {
  // portrait fills the width edge to edge
  if (w < h) {
    const visW = w / PX_PER_CM.phone;
    return { bayW: Math.min(170, Math.max(60, visW - 2 * CASE.side)), crown: CROWN };
  }
  // landscape stands a centred column in a wood-panelled room
  const visW = w / PX_PER_CM.desktop;
  return { bayW: Math.min(170, Math.max(100, visW * 0.5 - 2 * CASE.side)), crown: CROWN, roomW: visW };
}

export function caseBounds(F: Frame = current) {
  const width = F.bayW + 2 * CASE.side;
  return {
    left: -width / 2,
    right: width / 2,
    top: interiorTop + CASE.board + F.crown + CASE.cornice,
    crownBottom: interiorTop + CASE.board,
    bot: -CASE.board - CASE.plinth,
  };
}

export type CaseBounds = ReturnType<typeof caseBounds>;

// interior x extent of the column
export function shelfSpan(F: Frame = current) {
  const x0 = caseBounds(F).left + CASE.side;
  return { x0, x1: x0 + F.bayW, cx: x0 + F.bayW / 2 };
}

// row-relative x, cm from the shelf's inner left side, for a world x
export const rowX = (worldX: number) => worldX - shelfSpan().x0;
