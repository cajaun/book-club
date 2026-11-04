// where a carried book can land without pushing another off the shelf

import type { Entry } from "../../catalog";
import { rowX, shelfSpan } from "../geometry/frame";
import { entryWidth } from "../layout/entries";
import { layoutRow } from "../layout/layout-all";
import { resolveRow } from "../layout/resolve-row";
import type { Rows } from "./types";

// true if entry at row-x fits without pushing any book off the shelf
export function fitsAt(row: Entry[], entry: Entry, x: number) {
  const before = resolveRow(row).filter((p) => p.hidden).length;
  const after = resolveRow(row, { entry, x });
  return (
    !after.some((p) => p.hidden && p.extra) &&
    after.filter((p) => p.hidden && !p.extra).length <= before
  );
}

// the spot nearest x that fits, trying the pointer first and then every gap
export function findSpot(row: Entry[], entry: Entry, x: number): number | null {
  if (fitsAt(row, entry, x)) return x;
  const span = shelfSpan();
  const vis = resolveRow(row).filter((p) => !p.hidden);
  const starts = [0.6, ...vis.map((p) => rowX(p.x + p.w) + 0.8)].filter(
    (c) => c + entryWidth(entry) <= span.x1 - span.x0 - 0.6,
  );
  starts.sort((a, b) => Math.abs(a - x) - Math.abs(b - x));
  for (const c of starts) if (fitsAt(row, entry, c)) return c;
  return null;
}

// the shelf under the pointer first, then the shelves below, then above
export function findShelf(
  rows: Rows,
  entry: Entry,
  shelf: number,
  x: number,
): { shelf: number; x: number } | null {
  const order = [shelf];
  for (let r = shelf + 1; r < rows.length; r++) order.push(r);
  for (let r = shelf - 1; r >= 0; r--) order.push(r);
  for (const r of order) {
    const fx = findSpot(rows[r], entry, x);
    if (fx !== null) return { shelf: r, x: fx };
  }
  return null;
}

// index of the stack whose middle sits under world x, a flat book dropped there joins it
export function stackUnder(
  rows: Rows,
  shelf: number,
  worldX: number,
): number | undefined {
  const { spans } = layoutRow(rows[shelf], shelf, new Map(), new Set());
  let found: number | undefined;
  for (const sp of spans) {
    if (sp.kind !== "stack" || sp.hidden) continue;
    const inset = (sp.x1 - sp.x0) * 0.22;
    if (worldX > sp.x0 + inset && worldX < sp.x1 - inset) found = sp.index;
  }
  return found;
}
