// shared shapes for arrangement edits

import type { Entry, ItemEntry } from "../../catalog";

export type Rows = Entry[][];

export interface Location {
  shelf: number;
  index: number;
  k: number; // position inside a stack, -1 for a standing book
}

// where a lifted book came from, so a cancelled drag can restore it
export interface Origin {
  shelf: number;
  x: number;
  stack: ItemEntry | null;
  k: number;
}

export interface DropTarget {
  shelf: number;
  x: number;
  stack?: number; // index of the stack it joins
}
