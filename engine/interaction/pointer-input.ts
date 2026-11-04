// turns pointer and wheel events into taps, long presses, drags and scrolling

import type { ShelfCamera } from "../camera/shelf-camera";
import type { DragController } from "./drag-controller";
import type { Selection } from "./selection";

interface Press {
  id: string | null; // book under the pointer when it went down
  x: number;
  y: number;
  lx: number; // last position
  ly: number;
  t: number; // time of the last move
  t0: number;
  cx0: number; // client position at down, for the quick-drag test
  cy0: number;
  pointerId: number;
  type: string;
  active: boolean; // carrying a book
  panning: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface PointerDeps {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  cam: ShelfCamera;
  drag: DragController;
  selection: Selection;
  enabled(): boolean; // the shelf takes input only while no close-up is up or flying
  pick(x: number, y: number): string | null;
  prepare(id: string): void; // warm the close-up art for a likely tap
  open(id: string): void;
  cyclePose(id: string): void;
}

const LONG_PRESS = 380; // ms before a still finger picks the book up
const SLOP = { mouse: 12, touch: 8 }; // px a click may wobble and stay a click
const QUICK_DRAG = { ms: 280, px: 26 }; // a drag this short and small was meant as a click
const FLING_MIN = 20; // px per second below which the shelf stops coasting

export class PointerInput {
  private press: Press | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private fling = 0; // vertical px per second
  private last: { x: number; y: number } | null = null;
  private abort = new AbortController();

  constructor(private d: PointerDeps) {}

  get holding() {
    return this.press !== null;
  }

  bind() {
    const el = this.d.root;
    const opts = { signal: this.abort.signal };
    el.addEventListener("pointerdown", (e) => this.onDown(e), opts);
    el.addEventListener("pointermove", (e) => this.onMove(e), opts);
    el.addEventListener("pointerup", (e) => this.onUp(e, false), opts);
    el.addEventListener("pointercancel", (e) => this.onUp(e, true), opts);
    el.addEventListener("pointerleave", () => !this.press && this.d.selection.setHover(null), opts);
    el.addEventListener("wheel", (e) => this.onWheel(e), { ...opts, passive: false });
  }

  unbind() {
    this.abort.abort();
    if (this.press?.timer) clearTimeout(this.press.timer);
  }

  // coasting after a swipe, and scrolling while a book is carried to the edge
  tick(dt: number) {
    if (!this.press && Math.abs(this.fling) > FLING_MIN) {
      this.d.cam.pan(this.fling * dt);
      this.fling *= Math.exp(-5 * dt);
    }
    if (this.last) this.d.drag.autoScroll(dt, this.last);
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.d.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent) {
    const el = this.d.root;
    if (!this.d.enabled() || e.button !== 0) return;
    // only the shelf itself, the header and panels handle their own input
    if (e.target !== this.d.canvas && e.target !== el) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    el.setPointerCapture(e.pointerId);
    this.fling = 0;
    if (this.pointers.size === 2) {
      // a second finger cancels any tap or pick-up in progress, there is no zoom
      if (this.press?.timer) clearTimeout(this.press.timer);
      if (this.press?.active) this.d.drag.end();
      this.press = null;
      return;
    }
    if (this.pointers.size > 2) return;
    const id = this.d.pick(p.x, p.y);
    const now = performance.now();
    const press: Press = {
      id,
      x: p.x,
      y: p.y,
      lx: p.x,
      ly: p.y,
      t: now,
      t0: now,
      cx0: e.clientX,
      cy0: e.clientY,
      pointerId: e.pointerId,
      type: e.pointerType,
      active: false,
      panning: false,
      timer: null,
    };
    this.press = press;
    if (!id) return;
    this.d.prepare(id);
    // a long press picks a book up, on touch it is the only way so a swipe starting on a book still scrolls
    press.timer = setTimeout(() => {
      if (this.press === press && !press.active && !press.panning) {
        navigator.vibrate?.(8);
        this.startDrag(press, press.lx, press.ly);
      }
    }, LONG_PRESS);
  }

  private onMove(e: PointerEvent) {
    const p = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (this.pointers.size >= 2) return;
    const d = this.press;
    if (!d || d.pointerId !== e.pointerId) {
      // plain hover, mouse only
      if (this.d.enabled()) this.d.selection.setHover(e.pointerType === "mouse" ? this.d.pick(p.x, p.y) : null);
      return;
    }
    this.last = p;
    const slop = d.type === "mouse" ? SLOP.mouse : SLOP.touch;
    if (!d.active && !d.panning && Math.hypot(p.x - d.x, p.y - d.y) > slop) {
      if (d.timer) clearTimeout(d.timer);
      // a mouse on a book drags it, anything else scrolls the shelf
      if (d.id && d.type === "mouse") this.startDrag(d, p.x, p.y);
      else d.panning = true;
    }
    if (d.active) this.d.drag.move(p.x, p.y);
    else if (d.panning) {
      const now = performance.now();
      this.fling = (p.y - d.ly) / (Math.max(1, now - d.t) / 1000);
      this.d.cam.pan(p.y - d.ly);
      this.d.root.style.cursor = "grabbing";
    }
    d.lx = p.x;
    d.ly = p.y;
    d.t = performance.now();
  }

  private onUp(e: PointerEvent, cancelled: boolean) {
    const el = this.d.root;
    this.pointers.delete(e.pointerId);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const d = this.press;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.timer) clearTimeout(d.timer);
    this.press = null;
    this.last = null;
    if (d.active) {
      const quick = performance.now() - d.t0 < QUICK_DRAG.ms && Math.hypot(e.clientX - d.cx0, e.clientY - d.cy0) < QUICK_DRAG.px;
      // a quick short drag was a click, put the book back and open it
      if (quick && !cancelled && this.d.drag.cancel()) this.d.open(d.id!);
      else this.d.drag.end();
      return;
    }
    if (d.panning) {
      el.style.cursor = "";
      // the finger stopped before lifting so there is nothing to coast
      if (performance.now() - d.t > 80) this.fling = 0;
      return;
    }
    if (cancelled) return;
    const sel = this.d.selection;
    if (!d.id) sel.setHandled(null);
    else if (d.id === sel.handled) this.d.cyclePose(d.id);
    else {
      sel.setHandled(null);
      this.d.open(d.id);
    }
  }

  private onWheel(e: WheelEvent) {
    if (!this.d.enabled()) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.d.cam.size.h : 1;
    // ctrl + wheel is page zoom, swallowed on purpose
    if (!e.ctrlKey) this.d.cam.pan(-e.deltaY * unit);
  }

  private startDrag(d: Press, x: number, y: number) {
    if (!d.id || !this.d.drag.start(d.id, x, y)) return;
    d.active = true;
    if (d.timer) clearTimeout(d.timer);
  }
}
