// read-only lookups on the arrangement

import type { ItemEntry, Pose } from "../../catalog";
import type { Location, Rows } from "./types";

export function locate(rows: Rows, id: string): Location | null {
  for (let shelf = 0; shelf < rows.length; shelf++) {
    const list = rows[shelf];
    for (let index = 0; index < list.length; index++) {
      const e = list[index];
      if (e.kind === "book" && e.id === id) return { shelf, index, k: -1 };
      if (e.kind === "stack") {
        const k = e.ids.indexOf(id);
        if (k >= 0) return { shelf, index, k };
      }
    }
  }
  return null;
}

export function poseIn(rows: Rows, id: string): Pose | null {
  const loc = locate(rows, id);
  if (!loc) return null;
  const e = rows[loc.shelf][loc.index];
  return e.kind === "book" ? e.pose : "flat";
}

export const poseOfEntry = (e: ItemEntry): Pose =>
  e.kind === "book" ? e.pose : "flat";

// every book in shelf order, stacks read top down
export function readingOrder(rows: Rows): string[] {
  const order: string[] = [];
  for (const list of rows)
    for (const e of list) {
      if (e.kind === "book") order.push(e.id);
      else if (e.kind === "stack") order.push(...e.ids.slice().reverse());
    }
  return order;
}
