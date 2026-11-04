// Shelf layout: a pure function from the arrangement (entries per shelf) to a
// world transform for every book. Dragging, pose changes and stacking only
// ever edit the arrangement; the scene animates towards whatever this returns.

import { Euler, Quaternion, Vector3 } from "three/webgpu";
import { BOOK_BY_ID, rng, type Entry } from "./books";

export const CASE = {
  W: 108, // interior width (cm)
  compH: 33, // clear height of a compartment
  board: 2.8, // shelf board thickness
  depth: 28, // interior depth (back wall at z = -depth)
  shelves: 5,
  crown: 30, // header board above the top compartment
  plinth: 9,
  side: 5,
};

export const surfaceY = (i: number) => (CASE.shelves - 1 - i) * (CASE.compH + CASE.board);
export const interiorTop = CASE.shelves * CASE.compH + (CASE.shelves - 1) * CASE.board;

export interface Target {
  pos: Vector3;
  quat: Quaternion;
}
export interface Span {
  index: number; // entry index in the shelf (or -1 for placeholder)
  x0: number;
  x1: number;
  kind: Entry["kind"] | "placeholder";
  top: number; // y of the top of the entry
}

const GAP_SPINE = 0.12;
const GAP_OTHER = 0.7;

const Q_SPINE = new Quaternion();
const Q_FACE = new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0.06, "YXZ"));
const Q_FLAT = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));

export function entryWidth(e: Entry): number {
  if (e.kind === "space") return e.w;
  if (e.kind === "stack") return Math.max(...e.ids.map((id) => BOOK_BY_ID[id].h)) + 0.6;
  const b = BOOK_BY_ID[e.id];
  return e.pose === "face" ? b.d : b.t;
}

export function entryHeight(e: Entry): number {
  if (e.kind === "space") return 0;
  if (e.kind === "stack") return e.ids.reduce((s, id) => s + BOOK_BY_ID[id].t, 0);
  const b = BOOK_BY_ID[e.id];
  return b.h;
}

function gapBetween(a: Entry | null, b: Entry | null) {
  if (!a || !b) return 0;
  if (a.kind === "space" || b.kind === "space") return 0;
  if (a.kind === "book" && b.kind === "book" && a.pose === "spine" && b.pose === "spine") return GAP_SPINE;
  return GAP_OTHER;
}

/**
 * Lay out one shelf. `placeholder` reserves room for a book that is being
 * dragged, so neighbours part to show where it will land.
 */
export function layoutShelf(
  entries: Entry[],
  shelf: number,
  out: Map<string, Target>,
  placeholder?: { index: number; entry: Entry },
): Span[] {
  const list: (Entry | { kind: "placeholder"; entry: Entry })[] = entries.slice();
  if (placeholder) list.splice(placeholder.index, 0, { kind: "placeholder", entry: placeholder.entry });

  const real = (e: (typeof list)[number]): Entry => (e.kind === "placeholder" ? e.entry : e);
  let fixed = 0;
  let spaces = 0;
  list.forEach((e, i) => {
    const r = real(e);
    if (r.kind === "space") spaces += r.w;
    else fixed += entryWidth(r);
    if (i > 0) fixed += gapBetween(real(list[i - 1]), r);
  });
  const free = CASE.W - 1.2 - fixed;
  const spaceScale = spaces > 0 ? Math.max(0, Math.min(2.2, free / spaces)) : 0;

  const y0 = surfaceY(shelf);
  let x = -CASE.W / 2 + 0.6;
  const spans: Span[] = [];
  let entryIndex = 0;
  list.forEach((e, i) => {
    const r = real(e);
    if (i > 0) x += gapBetween(real(list[i - 1]), r);
    const w = r.kind === "space" ? r.w * spaceScale : entryWidth(r);
    const isPh = e.kind === "placeholder";
    spans.push({ index: isPh ? -1 : entryIndex, x0: x, x1: x + w, kind: isPh ? "placeholder" : r.kind, top: y0 + entryHeight(r) });
    if (!isPh) {
      placeEntry(r, x, w, y0, out);
      entryIndex++;
    }
    x += w;
  });
  return spans;
}

function placeEntry(e: Entry, x: number, w: number, y0: number, out: Map<string, Target>) {
  if (e.kind === "space") return;
  if (e.kind === "book") {
    const b = BOOK_BY_ID[e.id];
    const r = rng(b.id + "jit");
    if (e.pose === "spine") {
      const push = r() * 0.9;
      out.set(b.id, {
        pos: new Vector3(x + w / 2, y0 + b.h / 2, -1.2 - push - b.d / 2),
        quat: Q_SPINE.clone(),
      });
    } else {
      // face-out: leans back slightly against the wall behind it
      out.set(b.id, {
        pos: new Vector3(x + w / 2, y0 + b.h / 2 * Math.cos(0.06) + 0.05, -4.5 - b.t / 2),
        quat: Q_FACE.clone(),
      });
    }
    return;
  }
  // stack: ids[0] is the bottom book
  let y = y0;
  e.ids.forEach((id, k) => {
    const b = BOOK_BY_ID[id];
    const r = rng(b.id + "stack" + k);
    const jx = (r() - 0.5) * 1.6;
    const jr = (r() - 0.5) * 0.06;
    const q = new Quaternion().setFromEuler(new Euler(0, jr, Math.PI / 2, "YXZ"));
    out.set(b.id, {
      pos: new Vector3(x + w / 2 + jx, y + b.t / 2, -1.4 - b.d / 2 - r() * 0.6),
      quat: q,
    });
    y += b.t;
  });
}

export function layoutAll(
  shelves: Entry[][],
  placeholder?: { shelf: number; index: number; entry: Entry },
): { targets: Map<string, Target>; spans: Span[][] } {
  const targets = new Map<string, Target>();
  const spans = shelves.map((entries, s) =>
    layoutShelf(entries, s, targets, placeholder && placeholder.shelf === s ? placeholder : undefined),
  );
  return { targets, spans };
}

export function poseQuat(pose: "spine" | "face" | "flat") {
  return (pose === "spine" ? Q_SPINE : pose === "face" ? Q_FACE : Q_FLAT).clone();
}

/** Room left on a shelf (cm) if `extra` were added to it. */
export function freeSpace(entries: Entry[], extra?: Entry): number {
  const list = extra ? [...entries, extra] : entries;
  let used = 0;
  list.forEach((e, i) => {
    if (e.kind !== "space") used += entryWidth(e);
    if (i > 0) used += gapBetween(list[i - 1], e);
  });
  return CASE.W - 1.2 - used;
}
