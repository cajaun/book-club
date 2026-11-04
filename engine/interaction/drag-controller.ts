// picking a book up, carrying it along or between shelves, and setting it down

import * as THREE from "three/webgpu";
import type { ItemEntry, Pose } from "../../domain/catalog";
import {
  CASE,
  caseBounds,
  dropAt,
  entryWidth,
  findShelf,
  liftOut,
  poseOfEntry,
  poseQuat,
  putBack,
  rowX,
  stackUnder,
  surfaceY,
  type DropTarget,
  type LayoutOptions,
  type Origin,
} from "../../domain/shelf";
import type { BookStore } from "../books/book-store";
import type { ShelfCamera } from "../camera/shelf-camera";
import { X_AXIS, Z_AXIS } from "../core/axes";
import { clearZ } from "../core/tween";
import type { ShelfController } from "../shelf/shelf-controller";
import type { Selection } from "./selection";

interface Drag {
  id: string;
  entry: ItemEntry;
  offset: THREE.Vector2; // book centre minus pointer, so it does not jump to the finger
  target: DropTarget;
  origin: Origin;
  vx: number; // smoothed horizontal speed, tilts the book
  lastX: number;
}

export interface DragDeps {
  cam: ShelfCamera;
  books: BookStore;
  shelf: ShelfController;
  selection: Selection;
  root: HTMLElement;
  invalidate(): void;
}

const EDGE = 80; // px from the top or bottom where a carried book scrolls the shelf
const EDGE_SPEED = 9;

export class DragController {
  private drag: Drag | null = null;

  constructor(private d: DragDeps) {}

  get active() {
    return this.drag !== null;
  }

  // the gap the shelf opens for the carried book, none while it hovers over a stack
  preview(): LayoutOptions["extra"] {
    const dr = this.drag;
    return dr && dr.target.stack === undefined
      ? { shelf: dr.target.shelf, entry: dr.entry, x: dr.target.x }
      : undefined;
  }

  poseOf(id: string): Pose | null {
    return this.drag?.id === id ? poseOfEntry(this.drag.entry) : null;
  }

  start(id: string, cx: number, cy: number) {
    const lifted = liftOut(this.d.shelf.rows, id);
    if (!lifted) return false;
    const s = this.d.books.get(id)!;
    const p = this.d.cam.pointOnPlane(cx, cy, clearZ(id));
    this.drag = {
      id,
      entry: lifted.entry,
      offset: new THREE.Vector2(s.pos.x - p.x, s.pos.y - p.y),
      target: { shelf: lifted.origin.shelf, x: lifted.origin.x },
      origin: lifted.origin,
      vx: 0,
      lastX: p.x,
    };
    s.follow = true;
    s.choreo = null;
    s.ret = null;
    this.d.selection.setHover(null);
    this.d.root.style.cursor = "grabbing";
    this.d.selection.setHandled(id);
    this.move(cx, cy);
    return true;
  }

  move(cx: number, cy: number) {
    const dr = this.drag;
    if (!dr) return;
    const rows = this.d.shelf.rows;
    const p = this.d.cam.pointOnPlane(cx, cy, clearZ(dr.id));
    const B = caseBounds();
    const bx = THREE.MathUtils.clamp(
      p.x + dr.offset.x,
      B.left + CASE.side + 2,
      B.right - CASE.side - 2,
    );
    const by = THREE.MathUtils.clamp(p.y + dr.offset.y, -2, B.crownBottom);
    dr.vx = THREE.MathUtils.lerp(dr.vx, p.x - dr.lastX, 0.35);
    dr.lastX = p.x;

    // the shelf whose compartment centre is nearest the book
    let shelf = 0;
    let best = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const dist = Math.abs(by - (surfaceY(i) + CASE.compH / 2));
      if (dist < best) {
        best = dist;
        shelf = i;
      }
    }
    // free placement: the book lands centred under the pointer, a flat book over a stack joins it
    const stack =
      dr.entry.kind === "stack" ? stackUnder(rows, shelf, bx) : undefined;
    let x = rowX(bx) - entryWidth(dr.entry) / 2;
    // a full shelf sends the book to the nearest shelf with room instead of pushing one off the end
    if (stack === undefined) {
      const spot = findShelf(rows, dr.entry, shelf, x);
      if (spot) ({ shelf, x } = spot);
    }
    const t = dr.target;
    if (t.shelf !== shelf || Math.abs(t.x - x) > 0.05 || t.stack !== stack) {
      dr.target = { shelf, x, stack };
      this.d.shelf.relayout();
    }

    // lifted, tilted with the motion and held towards the reader
    const pose = poseOfEntry(dr.entry);
    const tilt =
      THREE.MathUtils.clamp(-dr.vx * 0.09, -0.45, 0.45) +
      (pose === "flat" ? 0 : -0.12);
    const s = this.d.books.get(dr.id)!;
    s.tPos.set(bx, by, clearZ(dr.id));
    s.tQuat
      .setFromAxisAngle(Z_AXIS, tilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, 0.12))
      .multiply(poseQuat(pose));
    this.d.invalidate();
  }

  // a drag that turned out to be a click puts the book back where it was
  cancel() {
    const dr = this.drag;
    if (!dr) return false;
    putBack(this.d.shelf.rows, dr.id, dr.entry, dr.origin);
    this.release(dr);
    this.d.shelf.relayout();
    return true;
  }

  end() {
    const dr = this.drag;
    if (!dr) return;
    const pin = dropAt(this.d.shelf.rows, dr.id, dr.entry, dr.target);
    this.release(dr);
    this.d.shelf.relayout(false, { shelf: dr.target.shelf, entry: pin }, true);
    this.d.shelf.choreograph(dr.id);
    this.d.selection.setHandled(dr.id);
  }

  // holding a book near the top or bottom edge scrolls the shelf under it
  autoScroll(dt: number, ptr: { x: number; y: number }) {
    if (!this.drag) return;
    const h = this.d.cam.size.h;
    const vy =
      ptr.y < EDGE
        ? (EDGE - ptr.y) * EDGE_SPEED
        : ptr.y > h - EDGE
          ? -(ptr.y - (h - EDGE)) * EDGE_SPEED
          : 0;
    if (!vy) return;
    this.d.cam.pan(vy * dt);
    this.move(ptr.x, ptr.y);
  }

  private release(dr: Drag) {
    this.d.books.get(dr.id)!.follow = false;
    this.drag = null;
    this.d.root.style.cursor = "";
  }
}
