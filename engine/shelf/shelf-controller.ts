// keeps the arrangement and drives every book towards the layout's targets

import { BOOK_BY_ID, type ItemEntry, type Pose } from "../../domain/catalog";
import {
  assignInitialX,
  changePose,
  idsOf,
  initialRows,
  layoutAll,
  locate,
  persistPositions,
  poseIn,
  readingOrder,
  surfaceY,
  type LayoutOptions,
  type Rows,
} from "../../domain/shelf";
import type { BookStore } from "../books/book-store";
import { place, syncVisible } from "../books/book-state";
import { startChoreo } from "../books/motion";
import type { Furniture } from "../render/furniture";

export interface ShelfDeps {
  books: BookStore;
  furniture: Furniture;
  reduced: boolean;
  preview(): LayoutOptions["extra"]; // where a dragged book would land, if anywhere
  onShelved(ids: Set<string>): void;
  invalidate(): void;
}

export interface Pin {
  shelf: number;
  entry: ItemEntry;
}

export class ShelfController {
  rows: Rows = [];

  constructor(private d: ShelfDeps) {}

  // starting arrangement for the current frame
  reset() {
    this.rows = assignInitialX(initialRows());
  }

  // ids the layout puts on a shelf right now
  visibleIds() {
    return [...layoutAll(this.rows).targets.keys()];
  }

  order() {
    return readingOrder(this.rows);
  }

  poseOf(id: string): Pose | null {
    return poseIn(this.rows, id);
  }

  // re-solves every row, snap skips the glide, pin holds one entry and persist keeps pushed positions
  relayout(snap = false, pin?: Pin, persist = false) {
    const { targets, spans, hidden, placed } = layoutAll(this.rows, {
      extra: this.d.preview(),
      pin,
    });
    if (persist) persistPositions(this.rows, placed);
    this.d.books.ensure(targets.keys());
    targets.forEach((t, id) => {
      const s = this.d.books.get(id)!;
      s.tPos.copy(t.pos);
      s.tQuat.copy(t.quat);
      // a book appearing or coming back on shelf is placed rather than flown in
      if (snap || s.offShelf) place(s, t.pos, t.quat);
      s.offShelf = false;
      syncVisible(s);
    });
    for (const id of hidden) {
      const s = this.d.books.get(id);
      if (s && !s.follow) {
        s.offShelf = true;
        syncVisible(s);
      }
    }
    // each plaque names the genre of the first book on its shelf
    spans.forEach((row, r) => {
      let genre: number | null = null;
      for (const sp of row) {
        if (sp.hidden || sp.index < 0) continue;
        const e = this.rows[r][sp.index];
        const ids = e ? idsOf(e) : [];
        if (!ids.length) continue;
        genre = BOOK_BY_ID[ids[0]].genreIndex;
        break;
      }
      this.d.furniture.showPlaque(r, genre);
    });
    this.d.onShelved(new Set(targets.keys()));
    this.d.invalidate();
  }

  // spine out, face out or laid flat, turned in place while the neighbours make room
  setPose(id: string, pose: Pose) {
    const changed = changePose(this.rows, id, pose);
    if (!changed) return false;
    this.relayout(false, changed, true);
    this.choreograph(id);
    return true;
  }

  // moves a book along a path that stays in front of the shelf while it turns
  choreograph(id: string) {
    const s = this.d.books.get(id);
    if (!s) return;
    const loc = locate(this.rows, id);
    startChoreo(
      s,
      loc ? surfaceY(loc.shelf) : null,
      this.d.reduced ? 0.25 : 0.75,
    );
    this.d.invalidate();
  }
}
