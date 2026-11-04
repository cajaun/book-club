// resolves one row: every entry wants its own x, overlaps get pushed apart

import type { Entry } from "../../catalog";
import { MARGIN, entryWidth, entryX, gapBetween } from "./entries";
import { shelfSpan } from "../geometry/frame";

export interface Placed {
  e: Entry;
  x: number; // world x of the left edge
  w: number;
  hidden: boolean; // past the shelf end, kept in storage
  extra: boolean; // the book being dragged, not in the row yet
}

export interface Preview {
  entry: Entry;
  x: number;
}

// pushes away from the pinned entry and squeezes gaps first, only a full row drops its last book
export function resolveRow(
  entries: Entry[],
  extra?: Preview,
  pin?: Entry,
): Placed[] {
  const span = shelfSpan();
  const lo = span.x0 + MARGIN;
  const hi = span.x1 - MARGIN;
  const items: Placed[] = entries
    .filter((e) => e.kind !== "space")
    .map((e) => ({
      e,
      x: span.x0 + entryX(e),
      w: entryWidth(e),
      hidden: false,
      extra: false,
    }));
  if (extra)
    items.push({
      e: extra.entry,
      x: span.x0 + extra.x,
      w: entryWidth(extra.entry),
      hidden: false,
      extra: true,
    });
  const pinned = (p: Placed) => p.extra || p.e === pin;
  // order by centre so a book widening in place pushes both neighbours evenly
  items.sort(
    (a, b) =>
      a.x + a.w / 2 - (b.x + b.w / 2) || (pinned(a) ? -1 : pinned(b) ? 1 : 0),
  );
  const n = items.length;
  const gap = (i: number) =>
    i > 0 ? gapBetween(items[i - 1].e, items[i].e) : 0;
  const p = items.findIndex(pinned);
  // entries already past the end are in storage and stay off the shelf
  let m = items.findIndex((it, i) => i !== p && it.x >= hi - 1e-6);
  if (m < 0) m = n;

  // push overlaps away from the pinned entry, or left to right without one
  for (let i = Math.max(1, p + 1); i < n; i++)
    items[i].x = Math.max(items[i].x, items[i - 1].x + items[i - 1].w + gap(i));
  for (let i = p - 1; i >= 0; i--)
    items[i].x = Math.min(items[i].x, items[i + 1].x - gap(i + 1) - items[i].w);

  // count how many shelf entries fit with every gap squeezed
  let k = 0;
  for (let i = 0, end = lo; i < m; i++) {
    end += (i > 0 ? gap(i) : 0) + items[i].w;
    if (end > hi + 1e-6) break;
    k = i + 1;
  }
  // keep those k inside the shelf, squeeze back from the right then from the left
  if (k > 0) {
    items[k - 1].x = Math.min(items[k - 1].x, hi - items[k - 1].w);
    for (let i = k - 2; i >= 0; i--)
      items[i].x = Math.min(
        items[i].x,
        items[i + 1].x - gap(i + 1) - items[i].w,
      );
    items[0].x = Math.max(items[0].x, lo);
    for (let i = 1; i < k; i++)
      items[i].x = Math.max(
        items[i].x,
        items[i - 1].x + items[i - 1].w + gap(i),
      );
  }
  for (let i = k; i < n; i++) items[i].hidden = true;
  return items;
}
