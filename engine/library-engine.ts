// wires the subsystems together, owns both canvases and runs the frame loop

import * as THREE from "three/webgpu";
import type { Pose } from "../domain/catalog";
import type { Fonts } from "../artwork";
import {
  caseBounds,
  fitFrame,
  frame,
  setFrame,
  type Frame,
} from "../domain/shelf";
import { BookStore, atlasPage } from "./books/book-store";
import { ShelfCamera } from "./camera/shelf-camera";
import { hasFlag, nextFrames } from "./core/browser";
import { HeroController } from "./hero/hero-controller";
import { DragController } from "./interaction/drag-controller";
import { PointerInput } from "./interaction/pointer-input";
import { Selection } from "./interaction/selection";
import { Furniture } from "./render/furniture";
import { LightRig } from "./render/lights";
import {
  backendName,
  createRenderer,
  exposureFor,
  type Renderer,
} from "./render/renderer";
import { ShelfController } from "./shelf/shelf-controller";
import type { EngineCallbacks } from "./types";

const POSE_CYCLE: Record<Pose, Pose> = {
  flat: "spine",
  spine: "face",
  face: "flat",
};

// a resize only rebuilds the case when the fitted frame moved by more than half a centimetre
const frameMoved = (a: Frame, b: Frame) =>
  Math.abs(a.bayW - b.bayW) > 0.5 || Math.abs(a.crown - b.crown) > 0.5;

export class LibraryEngine {
  private shelfR!: Renderer;
  private heroR!: Renderer;
  private scene = new THREE.Scene();
  private lights!: LightRig;
  private cam: ShelfCamera;
  private furniture: Furniture;
  private books: BookStore;
  private shelf: ShelfController;
  private hero: HeroController;
  private selection: Selection;
  private drag: DragController;
  private input: PointerInput;
  private reduced = false;
  private dirty = true;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private ro?: ResizeObserver;

  constructor(
    private root: HTMLElement,
    private shelfCanvas: HTMLCanvasElement,
    private heroCanvas: HTMLCanvasElement,
    fonts: Fonts,
    private cb: EngineCallbacks,
  ) {
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const invalidate = () => (this.dirty = true);
    this.cam = new ShelfCamera(cb.onHeaderRect, invalidate);
    this.furniture = new Furniture(this.scene, fonts);
    this.books = new BookStore(this.scene, fonts);
    this.shelf = new ShelfController({
      books: this.books,
      furniture: this.furniture,
      reduced: this.reduced,
      preview: () => this.drag.preview(),
      onShelved: cb.onShelved,
      invalidate,
    });
    this.selection = new Selection({
      root,
      onHandle: cb.onHandle,
      poseOf: (id) => this.poseOf(id),
      isHolding: () => this.drag.active || this.input.holding,
      invalidate,
    });
    this.drag = new DragController({
      cam: this.cam,
      books: this.books,
      shelf: this.shelf,
      selection: this.selection,
      root,
      invalidate,
    });
    this.hero = new HeroController(
      {
        cam: this.cam,
        books: this.books,
        root,
        cb,
        reduced: this.reduced,
        poseOf: (id) => this.poseOf(id),
        order: () => this.shelf.order(),
        aimLights: (q, lw) => this.lights.aimHero(q, lw),
        invalidateShelf: invalidate,
      },
      fonts,
    );
    this.input = new PointerInput({
      root,
      canvas: shelfCanvas,
      cam: this.cam,
      drag: this.drag,
      selection: this.selection,
      enabled: () => this.hero.mode === "shelf" && !this.hero.busy,
      pick: (x, y) => this.cam.pick(x, y, this.books.visibleMeshes()),
      prepare: (id) => this.hero.prepare(id),
      open: (id) => this.open(id),
      cyclePose: (id) => this.setPose(id, POSE_CYCLE[this.poseOf(id)]),
    });
  }

  async init() {
    const forceWebGL = hasFlag("webgl");
    const onLost = () => this.cb.onLost();
    // both gpu contexts start at once
    [this.shelfR, this.heroR] = await Promise.all([
      createRenderer(this.shelfCanvas, forceWebGL, onLost),
      createRenderer(this.heroCanvas, forceWebGL, onLost),
    ]);
    this.shelfR.shadowMap.enabled = true;
    this.shelfR.shadowMap.type = THREE.PCFShadowMap;
    this.cb.onBackend(backendName(this.shelfR));
    if (hasFlag("debug"))
      (window as unknown as { __shelf: unknown }).__shelf = this;

    const r = this.root.getBoundingClientRect();
    setFrame(fitFrame(r.width, Math.max(1, r.height)));
    this.shelf.reset();
    this.furniture.build();
    this.lights = new LightRig(this.scene, this.hero.scene, caseBounds());
    this.resize();

    // the slow part draws each atlas page in turn and yields between pages so the page stays responsive
    const ids = this.shelf.visibleIds();
    for (const page of new Set(ids.map(atlasPage))) {
      this.books.ensure(ids.filter((id) => atlasPage(id) === page));
      await nextFrames(1);
    }
    this.shelf.relayout(true);
    await this.hero.warmUp(this.heroR);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
    this.input.bind();
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
    };
    this.raf = requestAnimationFrame(loop);
  }

  // public api

  open(id: string) {
    if (this.hero.open(id)) this.selection.setHover(null);
  }

  close() {
    this.hero.close();
  }

  step(dir: 1 | -1) {
    this.hero.step(dir);
  }

  openReader() {
    this.hero.openReader();
  }

  closeReader() {
    this.hero.closeReader();
  }

  setPose(id: string, pose: Pose) {
    if (this.shelf.setPose(id, pose)) this.selection.setHandled(id);
  }

  setHover(id: string | null) {
    this.selection.setHover(id);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.input.unbind();
    this.selection.dispose();
    this.hero.dispose();
    this.scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.books.dispose();
    this.shelfR?.dispose();
    this.heroR?.dispose();
  }

  // internals

  // a book on the shelf, then one being carried, else spine out
  private poseOf(id: string): Pose {
    return this.shelf.poseOf(id) ?? this.drag.poseOf(id) ?? "spine";
  }

  private resize() {
    const r = this.root.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    // resizing wipes a canvas, so resize on a real change only and redraw in the same task
    const changed = this.cam.setSize(w, h);
    if (changed) {
      this.shelfR.setSize(w, h, false);
      this.heroR.setSize(w, h, false);
    }
    const fitted = fitFrame(w, h);
    if (
      changed &&
      this.hero.mode === "shelf" &&
      !this.drag.active &&
      frameMoved(fitted, frame())
    ) {
      setFrame(fitted);
      this.furniture.build();
      this.lights.aim(caseBounds());
      // books glide to their new places
      this.shelf.relayout();
      this.cam.resetView();
    }
    const exposure = exposureFor(w, h);
    this.shelfR.toneMappingExposure = exposure;
    this.heroR.toneMappingExposure = exposure;
    this.cam.apply();
    if (changed) {
      this.shelfR.render(this.scene, this.cam.camera);
      this.heroR.render(this.hero.scene, this.cam.camera);
      this.dirty = false;
    }
  }

  private frame(dt: number) {
    if (this.hero.mode === "shelf") this.input.tick(dt);
    const dragging = this.drag.active;
    const moving = this.books.step(dt, (id) =>
      this.selection.lift(id, dragging),
    );
    const heroNeedsRender = this.hero.tick(dt);
    if (moving || this.dirty) {
      this.shelfR.render(this.scene, this.cam.camera);
      this.dirty = false;
    }
    if (heroNeedsRender) this.heroR.render(this.hero.scene, this.cam.camera);
  }
}
