// widths and spacing of arrangement entries

import { BOOK_BY_ID, type Entry } from "../../catalog";

const GAP_SPINE = 0.12; // spines touch
const GAP_OTHER = 0.7; // anything else gets a little air
export const MARGIN = 0.6; // clearance from the side panels

export function entryWidth(e: Entry): number {
  if (e.kind === "space") return e.w;
  // a stack lies on its side so its width is the tallest book's height
  if (e.kind === "stack")
    return Math.max(...e.ids.map((id) => BOOK_BY_ID[id].h)) + 0.6;
  const b = BOOK_BY_ID[e.id];
  return e.pose === "face" ? b.d : b.t;
}

export function gapBetween(a: Entry | null, b: Entry | null) {
  if (!a || !b || a.kind === "space" || b.kind === "space") return 0;
  if (
    a.kind === "book" &&
    b.kind === "book" &&
    a.pose === "spine" &&
    b.pose === "spine"
  )
    return GAP_SPINE;
  return GAP_OTHER;
}

export function idsOf(e: Entry): string[] {
  return e.kind === "book" ? [e.id] : e.kind === "stack" ? e.ids : [];
}

export const entryX = (e: Entry) => (e.kind === "space" ? 0 : (e.x ?? 0));

export const sortByX = (row: Entry[]) =>
  row.sort((a, b) => entryX(a) - entryX(b));
