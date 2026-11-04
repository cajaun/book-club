// the starting arrangement, measured once the screen size is known

import { GENRE_LAYOUTS, type Entry } from "../../catalog";
import { MARGIN, entryWidth, gapBetween } from "../layout/entries";
import { frame } from "../geometry/frame";
import { CASE } from "../geometry/dimensions";

// row r holds genres r, r + 5 and r + 10 in sequence, a phone shows the first
export function initialRows(): Entry[][] {
  const clone = (e: Entry): Entry =>
    e.kind === "stack" ? { ...e, ids: [...e.ids] } : { ...e };
  return Array.from({ length: CASE.shelves }, (_, r) => {
    const row: Entry[] = [];
    for (let g = r; g < GENRE_LAYOUTS.length; g += CASE.shelves) {
      if (row.length) row.push({ kind: "space", w: 10 });
      row.push(...GENRE_LAYOUTS[g].map(clone));
    }
    return row;
  });
}

// turns spacers into positions, a shelf starts at most 85% full with 29 cm spare for the tallest book laid flat
export function assignInitialX(rows: Entry[][], fill = 0.85) {
  const F = frame();
  const cap = Math.min(F.bayW * fill, F.bayW - 29);
  return rows.map((row) => {
    let x = MARGIN;
    let prev: Entry | null = null;
    let stored = F.bayW + 1;
    const out: Entry[] = [];
    for (const e of row) {
      if (e.kind === "space") {
        x += e.w;
        continue;
      }
      const at = x + gapBetween(prev, e);
      // once one book goes to storage the rest queue after it in order
      if (stored > F.bayW + 1 || at + entryWidth(e) > cap) {
        e.x = stored;
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
