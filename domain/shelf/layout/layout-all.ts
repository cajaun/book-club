// pure layout pass from the arrangement to a target per book, the scene animates towards it

import type { Entry } from "../../catalog";
import { surfaceY } from "../geometry/dimensions";
import { idsOf } from "./entries";
import { placeEntry, type Target } from "./placement";
import { resolveRow, type Placed, type Preview } from "./resolve-row";

export interface Span {
  index: number; // entry index in the row, -1 for the drag preview
  x0: number;
  x1: number;
  kind: Entry["kind"] | "placeholder";
  hidden: boolean;
}

export interface RowLayout {
  spans: Span[];
  placed: Placed[];
}

export function layoutRow(
  entries: Entry[],
  row: number,
  out: Map<string, Target>,
  hidden: Set<string>,
  extra?: Preview,
  pin?: Entry,
): RowLayout {
  const placed = resolveRow(entries, extra, pin);
  const y0 = surfaceY(row);
  const spans = placed.map(
    (it): Span => ({
      index: it.extra ? -1 : entries.indexOf(it.e),
      x0: it.hidden ? Infinity : it.x,
      x1: it.hidden ? Infinity : it.x + it.w,
      kind: it.extra ? "placeholder" : it.e.kind,
      hidden: it.hidden,
    }),
  );
  for (const it of placed) {
    // the preview only makes room, the dragged book follows the pointer
    if (it.extra) continue;
    if (it.hidden) idsOf(it.e).forEach((id) => hidden.add(id));
    else placeEntry(it.e, it.x, it.w, y0, out);
  }
  return { spans, placed };
}

export interface LayoutOptions {
  extra?: Preview & { shelf: number };
  pin?: { shelf: number; entry: Entry };
}

export function layoutAll(rows: Entry[][], opts: LayoutOptions = {}) {
  const targets = new Map<string, Target>();
  const hidden = new Set<string>();
  const spans: Span[][] = [];
  const placed: Placed[][] = [];
  rows.forEach((entries, r) => {
    const extra = opts.extra?.shelf === r ? opts.extra : undefined;
    const pin = opts.pin?.shelf === r ? opts.pin.entry : undefined;
    const res = layoutRow(entries, r, targets, hidden, extra, pin);
    spans.push(res.spans);
    placed.push(res.placed);
  });
  return { targets, spans, hidden, placed };
}
