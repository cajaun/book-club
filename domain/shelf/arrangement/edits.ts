// edits to the arrangement, each one mutates the rows it is given

import type { ItemEntry, Pose } from "../../catalog";
import { rowX } from "../geometry/frame";
import { entryWidth, sortByX } from "../layout/entries";
import type { Placed } from "../layout/resolve-row";
import { locate } from "./queries";
import type { DropTarget, Origin, Rows } from "./types";

// turns a book in place around its centre, neighbours make room later in the layout
export function changePose(
  rows: Rows,
  id: string,
  pose: Pose,
): { shelf: number; entry: ItemEntry } | null {
  const loc = locate(rows, id);
  if (!loc) return null;
  const list = rows[loc.shelf];
  const e = list[loc.index];
  if (e.kind === "space") return null;
  const ex = e.x ?? 0;
  const center = ex + entryWidth(e) / 2;
  let changed: ItemEntry;
  if (e.kind === "book") {
    if (pose === "flat")
      changed = list[loc.index] = { kind: "stack", ids: [id] };
    else {
      e.pose = pose;
      changed = e;
    }
    changed.x = center - entryWidth(changed) / 2;
  } else {
    if (pose === "flat") return null;
    if (e.ids.length === 1) {
      changed = list[loc.index] = { kind: "book", id, pose };
      changed.x = center - entryWidth(changed) / 2;
    } else {
      // a book taken off a stack stands up beside it
      e.ids.splice(loc.k, 1);
      changed = { kind: "book", id, pose, x: ex + entryWidth(e) + 0.7 };
      list.splice(loc.index + 1, 0, changed);
    }
  }
  return { shelf: loc.shelf, entry: changed };
}

// removes a book from the rows for dragging, a book from a stack leaves alone
export function liftOut(
  rows: Rows,
  id: string,
): { entry: ItemEntry; origin: Origin } | null {
  const loc = locate(rows, id);
  if (!loc) return null;
  const list = rows[loc.shelf];
  const e = list[loc.index] as ItemEntry;
  let entry: ItemEntry;
  if (e.kind === "stack") {
    e.ids.splice(loc.k, 1);
    entry = { kind: "stack", ids: [id], x: e.x };
    if (e.ids.length === 0) list.splice(loc.index, 1);
  } else {
    entry = list.splice(loc.index, 1)[0] as ItemEntry;
  }
  const x = entry.x ?? 0;
  return {
    entry,
    origin: {
      shelf: loc.shelf,
      x,
      stack: e.kind === "stack" && e.ids.length > 0 ? e : null,
      k: loc.k,
    },
  };
}

// undoes liftOut
export function putBack(
  rows: Rows,
  id: string,
  entry: ItemEntry,
  origin: Origin,
) {
  const list = rows[origin.shelf];
  const st = origin.stack;
  if (st && st.kind === "stack" && list.includes(st))
    st.ids.splice(origin.k, 0, id);
  else {
    entry.x = origin.x;
    list.push(entry);
    sortByX(list);
  }
}

// places a dragged book and returns the entry the layout should pin
export function dropAt(
  rows: Rows,
  id: string,
  entry: ItemEntry,
  target: DropTarget,
): ItemEntry {
  const list = rows[target.shelf];
  const st = target.stack !== undefined ? list[target.stack] : undefined;
  if (st && st.kind === "stack") {
    st.ids.push(id);
    return st;
  }
  entry.x = target.x;
  list.push(entry);
  return entry;
}

// writes resolved positions back so pushed books stay pushed
export function persistPositions(rows: Rows, placed: Placed[][]) {
  placed.forEach((row, r) => {
    const vis = row.filter((p) => !p.extra && !p.hidden);
    const last = vis[vis.length - 1];
    let tail = last ? rowX(last.x + last.w) : 0;
    for (const p of row) {
      if (p.extra) continue;
      const e = p.e as ItemEntry;
      // books that no longer fit queue up past the end in order
      if (p.hidden) e.x = Math.max(e.x ?? 0, (tail += 1));
      else e.x = rowX(p.x);
    }
    sortByX(rows[r]);
  });
}
