// Shelf layout: a pure function from the arrangement (entries per row) to a
// world transform for every book. Dragging, pose changes and stacking only
// ever edit the arrangement; the scene animates towards whatever this returns.
//
// The bookcase always has exactly five shelves (rows) and one column. On
// phones and tablets it fills the screen edge to edge; on desktop it stands in
// the middle of the room. Books that don't fit on a row wait off-shelf.

import { Euler, Quaternion, Vector3 } from "three/webgpu";
import { BOOK_BY_ID, rng, type Entry } from "./books";

export const CASE = {
  W: 108, // nominal bay interior width (cm)
  compH: 31.5, // clear height of a compartment (tallest book is 30)
  board: 2.8, // shelf board thickness
  depth: 28, // interior depth (back wall at z = -depth)
  shelves: 5, // rows, always
  plinth: 9,
  side: 5, // side panel / divider thickness
  cornice: 2.4,
};

/** Surface height of row `r` (0 = top). */
export const surfaceY = (r: number) => (CASE.shelves - 1 - r) * (CASE.compH + CASE.board);
export const interiorTop = CASE.shelves * CASE.compH + (CASE.shelves - 1) * CASE.board;

// ---------------------------------------------------------------- frame
export interface Frame {
  bays: number;
  bayW: number; // interior width of each bay
  crown: number; // height of the header board (absorbs spare height on tall phones)
  /** Desktop: full screen width; the wall either side is wood panelling. */
  roomW?: number;
}
let FRAME: Frame = { bays: 1, bayW: CASE.W, crown: 30 };
export const frame = () => FRAME;
export const setFrame = (f: Frame) => {
  FRAME = f;
};

// Fixed zoom (no pinch): how many screen pixels one centimetre of bookcase
// gets. Five shelves are taller than the screen at this size, so the page
// scrolls vertically; the width always fills the screen edge to edge.
export const PX_PER_CM = { phone: 5.2, desktop: 6.2 };
const CROWN = 26;

/**
 * Size the single-column case to the screen. Phones/tablets: the bay is as
 * wide as the screen shows at this zoom (edge to edge). Desktop: a centred
 * column whose sides carry on as plain wood to the screen edges.
 */
export function fitFrame(w: number, h: number): Frame {
  if (w < h) {
    const visW = w / PX_PER_CM.phone;
    const bayW = Math.min(170, Math.max(60, visW - 2 * CASE.side));
    return { bays: 1, bayW, crown: CROWN };
  }
  const visW = w / PX_PER_CM.desktop;
  const bayW = Math.min(170, Math.max(100, visW * 0.5 - 2 * CASE.side));
  return { bays: 1, bayW, crown: CROWN, roomW: visW };
}

export function caseBounds() {
  const width = FRAME.bays * FRAME.bayW + (FRAME.bays + 1) * CASE.side;
  return {
    left: -width / 2,
    right: width / 2,
    top: interiorTop + CASE.board + FRAME.crown + CASE.cornice,
    crownBottom: interiorTop + CASE.board,
    bot: -CASE.board - CASE.plinth,
  };
}

/** Interior x-extent of each bay. */
export function baySegs() {
  const B = caseBounds();
  return Array.from({ length: FRAME.bays }, (_, b) => {
    const x0 = B.left + CASE.side + b * (FRAME.bayW + CASE.side);
    return { x0, x1: x0 + FRAME.bayW, cx: x0 + FRAME.bayW / 2 };
  });
}

// ---------------------------------------------------------------- entries

export interface Target {
  pos: Vector3;
  quat: Quaternion;
}
export interface Span {
  index: number; // entry index in the row (or -1 for placeholder)
  x0: number;
  x1: number;
  kind: Entry["kind"] | "placeholder";
  bay: number;
  hidden: boolean;
}

const GAP_SPINE = 0.12;
const GAP_OTHER = 0.7;
const MARGIN = 0.6;

const Q_SPINE = new Quaternion();
const Q_FACE = new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0.06, "YXZ"));
const Q_FLAT = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));

export function entryWidth(e: Entry): number {
  if (e.kind === "space") return e.w;
  if (e.kind === "stack") return Math.max(...e.ids.map((id) => BOOK_BY_ID[id].h)) + 0.6;
  const b = BOOK_BY_ID[e.id];
  return e.pose === "face" ? b.d : b.t;
}

function gapBetween(a: Entry | null, b: Entry | null) {
  if (!a || !b) return 0;
  if (a.kind === "space" || b.kind === "space") return 0;
  if (a.kind === "book" && b.kind === "book" && a.pose === "spine" && b.pose === "spine") return GAP_SPINE;
  return GAP_OTHER;
}

/**
 * Turn the initial arrangement's spacers into positions, then drop them.
 * Each shelf starts at most ~85% full and always with ~29 cm spare, so you can
 * lay a book flat or turn one face-out by squeezing gaps without anything
 * dropping off; the rest wait in storage past the end.
 */
export function assignInitialX(rows: Entry[][], fill = 0.85) {
  // leave enough room to lay any one book flat (tallest is 30 cm)
  const cap = Math.min(FRAME.bayW * fill, FRAME.bayW - 29);
  return rows.map((row) => {
    let x = MARGIN;
    let prev: Entry | null = null;
    let stored = FRAME.bayW + 1;
    const out: Entry[] = [];
    for (const e of row) {
      if (e.kind === "space") {
        x += e.w;
        continue;
      }
      const at = x + gapBetween(prev, e);
      if (stored > FRAME.bayW + 1 || at + entryWidth(e) > cap) {
        e.x = stored; // keep order, off the shelf
        stored += entryWidth(e) + 1;
      } else {
        e.x = at;
        x = at + entryWidth(e);
        prev = e;
      }
      out.push(e);
    }
    return out;
  });
}

export interface Placed {
  e: Entry;
  x: number; // world x of the left edge
  w: number;
  hidden: boolean;
  extra: boolean; // the book being dragged (not in the row yet)
}

/**
 * Resolve a row: every entry wants to sit at its own x. Overlaps are pushed
 * apart — away from the pinned entry (the one being dragged or just changed),
 * so it stays exactly where you put it. Gaps squeeze before anything leaves
 * the shelf; only when the row is genuinely full does its last book drop off.
 */
export function resolveRow(entries: Entry[], extra?: { entry: Entry; x: number }, pin?: Entry): Placed[] {
  const seg = baySegs()[0];
  const lo = seg.x0 + MARGIN;
  const hi = seg.x1 - MARGIN;
  const items: Placed[] = entries
    .filter((e) => e.kind !== "space")
    .map((e) => ({ e, x: seg.x0 + (e.x ?? 0), w: entryWidth(e), hidden: false, extra: false }));
  if (extra) items.push({ e: extra.entry, x: seg.x0 + extra.x, w: entryWidth(extra.entry), hidden: false, extra: true });
  const pinned = (p: Placed) => p.extra || p.e === pin;
  // order by centre, so a book that widens in place (laid flat, turned face
  // out) keeps its place in the run and pushes both neighbours evenly
  items.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2) || (pinned(a) ? -1 : pinned(b) ? 1 : 0));
  const n = items.length;
  const gap = (i: number) => (i > 0 ? gapBetween(items[i - 1].e, items[i].e) : 0);
  const p = items.findIndex(pinned);
  // books whose own position is past the end of the shelf are "in storage":
  // they stay off-shelf (a shelf isn't packed to the brim just because it could be)
  let m = items.findIndex((it, i) => i !== p && it.x >= hi - 1e-6);
  if (m < 0) m = n;

  // 1. push overlaps away from the pinned entry (or left-to-right without one)
  for (let i = Math.max(1, p + 1); i < n; i++) items[i].x = Math.max(items[i].x, items[i - 1].x + items[i - 1].w + gap(i));
  for (let i = p - 1; i >= 0; i--) items[i].x = Math.min(items[i].x, items[i + 1].x - gap(i + 1) - items[i].w);

  // 2. of the books that belong on the shelf, how many fit (gaps squeezed)
  let k = 0;
  for (let i = 0, end = lo; i < m; i++) {
    end += (i > 0 ? gap(i) : 0) + items[i].w;
    if (end > hi + 1e-6) break;
    k = i + 1;
  }
  // 3. keep the first k inside the shelf: squeeze back from the right, then from the left
  if (k > 0) {
    items[k - 1].x = Math.min(items[k - 1].x, hi - items[k - 1].w);
    for (let i = k - 2; i >= 0; i--) items[i].x = Math.min(items[i].x, items[i + 1].x - gap(i + 1) - items[i].w);
    items[0].x = Math.max(items[0].x, lo);
    for (let i = 1; i < k; i++) items[i].x = Math.max(items[i].x, items[i - 1].x + items[i - 1].w + gap(i));
  }
  for (let i = k; i < n; i++) items[i].hidden = true;
  return items;
}

/**
 * Lay out one row. `extra` is a book being dragged: it is shown where it would
 * land and neighbours make room for it.
 */
export function layoutRow(
  entries: Entry[],
  row: number,
  out: Map<string, Target>,
  hidden: Set<string>,
  extra?: { entry: Entry; x: number },
  pin?: Entry,
): { spans: Span[]; placed: Placed[] } {
  const placed = resolveRow(entries, extra, pin);
  const y0 = surfaceY(row);
  const spans: Span[] = [];
  for (const it of placed) {
    spans.push({
      index: it.extra ? -1 : entries.indexOf(it.e),
      x0: it.hidden ? Infinity : it.x,
      x1: it.hidden ? Infinity : it.x + it.w,
      kind: it.extra ? "placeholder" : it.e.kind,
      bay: it.hidden ? -1 : 0,
      hidden: it.hidden,
    });
    if (it.extra) continue;
    if (it.hidden) idsOf(it.e).forEach((id) => hidden.add(id));
    else placeEntry(it.e, it.x, it.w, y0, out);
  }
  return { spans, placed };
}

export function idsOf(e: Entry): string[] {
  return e.kind === "book" ? [e.id] : e.kind === "stack" ? e.ids : [];
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
        pos: new Vector3(x + w / 2, y0 + (b.h / 2) * Math.cos(0.06) + 0.05, -4.5 - b.t / 2),
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
  rows: Entry[][],
  opts: { extra?: { shelf: number; entry: Entry; x: number }; pin?: { shelf: number; entry: Entry } } = {},
): { targets: Map<string, Target>; spans: Span[][]; hidden: Set<string>; placed: Placed[][] } {
  const targets = new Map<string, Target>();
  const hidden = new Set<string>();
  const spans: Span[][] = [];
  const placed: Placed[][] = [];
  rows.forEach((entries, r) => {
    const res = layoutRow(
      entries,
      r,
      targets,
      hidden,
      opts.extra && opts.extra.shelf === r ? opts.extra : undefined,
      opts.pin && opts.pin.shelf === r ? opts.pin.entry : undefined,
    );
    spans.push(res.spans);
    placed.push(res.placed);
  });
  return { targets, spans, hidden, placed };
}

/** Row-relative x (cm from the shelf's inner left) for a world x. */
export const rowX = (worldX: number) => worldX - baySegs()[0].x0;

export function poseQuat(pose: "spine" | "face" | "flat") {
  return (pose === "spine" ? Q_SPINE : pose === "face" ? Q_FACE : Q_FLAT).clone();
}
