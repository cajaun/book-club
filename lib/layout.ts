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

type Item = Entry | { kind: "placeholder"; entry: Entry };
const real = (e: Item): Entry => (e.kind === "placeholder" ? e.entry : e);

/**
 * Flow the row's entries left to right through the bays, never letting an
 * entry straddle a divider. Spaces are scaled by `scale`; a space that hits a
 * divider is dropped. Returns placements and how many items fit.
 */
function flow(list: Item[], scale: number) {
  const segs = baySegs();
  let si = 0;
  let x = segs[0].x0 + MARGIN;
  let prev: Entry | null = null;
  const placed: { x: number; w: number; bay: number }[] = [];
  let fit = list.length;
  for (let i = 0; i < list.length; i++) {
    const r = real(list[i]);
    const atStart = x <= segs[si].x0 + MARGIN + 1e-6;
    if (r.kind === "space") {
      const w = atStart ? 0 : Math.min(r.w * scale, Math.max(0, segs[si].x1 - MARGIN - x));
      placed.push({ x, w, bay: si });
      x += w;
      continue;
    }
    const w = entryWidth(r);
    let gap = atStart ? 0 : gapBetween(prev, r);
    if (x + gap + w > segs[si].x1 - MARGIN) {
      si++;
      if (si >= segs.length) {
        fit = i;
        break;
      }
      x = segs[si].x0 + MARGIN;
      gap = 0;
    }
    x += gap;
    placed.push({ x, w, bay: si });
    x += w;
    prev = r;
  }
  return { placed, fit };
}

/**
 * Lay out one row. `placeholder` reserves room for a book that is being
 * dragged, so neighbours part to show where it will land.
 */
export function layoutRow(
  entries: Entry[],
  row: number,
  out: Map<string, Target>,
  hidden: Set<string>,
  placeholder?: { index: number; entry: Entry },
): Span[] {
  const list: Item[] = entries.slice();
  if (placeholder) list.splice(placeholder.index, 0, { kind: "placeholder", entry: placeholder.entry });

  // which entries fit at natural spacing; then open the gaps up (up to 4x)
  // as far as possible without pushing anything else off the shelf
  const base = flow(list, 1);
  let best = base;
  for (let s = 4; s > 1.01; s *= 0.88) {
    const f = flow(list, s);
    if (f.fit >= base.fit) {
      best = f;
      break;
    }
  }

  const y0 = surfaceY(row);
  const spans: Span[] = [];
  let entryIndex = 0;
  list.forEach((e, i) => {
    const r = real(e);
    const isPh = e.kind === "placeholder";
    const p = i < best.fit ? best.placed[i] : undefined;
    spans.push({
      index: isPh ? -1 : entryIndex,
      x0: p ? p.x : Infinity,
      x1: p ? p.x + p.w : Infinity,
      kind: isPh ? "placeholder" : r.kind,
      bay: p ? p.bay : -1,
      hidden: !p,
    });
    if (!isPh) {
      if (!p) idsOf(r).forEach((id) => hidden.add(id));
      else placeEntry(r, p.x, p.w, y0, out);
      entryIndex++;
    }
  });
  return spans;
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
  placeholder?: { shelf: number; index: number; entry: Entry },
): { targets: Map<string, Target>; spans: Span[][]; hidden: Set<string> } {
  const targets = new Map<string, Target>();
  const hidden = new Set<string>();
  const spans = rows.map((entries, r) =>
    layoutRow(entries, r, targets, hidden, placeholder && placeholder.shelf === r ? placeholder : undefined),
  );
  return { targets, spans, hidden };
}

export function poseQuat(pose: "spine" | "face" | "flat") {
  return (pose === "spine" ? Q_SPINE : pose === "face" ? Q_FACE : Q_FLAT).clone();
}
