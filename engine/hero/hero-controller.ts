// the close-up: flies a book off the shelf, holds it in the detail view, opens it and flies it back

import * as THREE from "three/webgpu";
import { BOOKS, type Pose } from "../../domain/catalog";
import type { Fonts } from "../../artwork";
import type { BookStore } from "../books/book-store";
import { place, syncVisible } from "../books/book-state";
import type { ShelfCamera } from "../camera/shelf-camera";
import { UP } from "../core/axes";
import { easeInOut, easeOut } from "../core/easing";
import { tweenPose, type PoseLike, type Tween } from "../core/tween";
import { precompile, type Renderer } from "../render/renderer";
import type { EngineCallbacks, Mode } from "../types";
import { ART_FAST, ART_SHARP, HeroArtCache } from "./hero-art";
import { createHero, swapArt, type Hero, type SharpSlot } from "./hero-model";
import { heroTarget } from "./hero-pose";

export interface HeroDeps {
  cam: ShelfCamera;
  books: BookStore;
  root: HTMLElement;
  cb: Pick<EngineCallbacks, "onMode" | "getSlot">;
  reduced: boolean;
  poseOf(id: string): Pose;
  order(): string[]; // every book in shelf order
  aimLights(quat: THREE.Quaternion, lw: number): void;
  invalidateShelf(): void;
}

// share of the return flight the close-up flies before the shelf copy takes over on the same curve
const HANDOFF = 0.72;

export class HeroController {
  readonly scene = new THREE.Scene();
  private art: HeroArtCache;
  private hero: Hero | null = null;
  private outgoing: Hero[] = []; // books sliding away after a step
  private _mode: Mode = "shelf";
  private _busy = false; // a flight that must finish before the next input
  private dirty = false;
  private time = 0;
  private disposed = false;

  constructor(
    private d: HeroDeps,
    fonts: Fonts,
  ) {
    this.art = new HeroArtCache(fonts);
  }

  get mode() {
    return this._mode;
  }

  get busy() {
    return this._busy;
  }

  // draws the close-up art early, on pointer down, so it is ready when the tap completes
  prepare(id: string) {
    this.art.get(id, ART_FAST);
  }

  open(id: string) {
    const s = this.d.books.get(id);
    if (this._mode !== "shelf" || this._busy || !s || s.offShelf) return false;
    const hero = this.make(id);
    hero.group.position.copy(s.pos);
    hero.group.quaternion.copy(s.quat);
    s.inHand = true;
    syncVisible(s);
    this.hero = hero;
    this.setMode("detail", id);
    this.d.invalidateShelf();
    const flat = this.d.poseOf(id) === "flat";
    hero.tween = {
      ...this.from(hero),
      to: () => this.target("detail", id),
      dur: this.dur(0.72, 0.25),
      ease: easeOut,
      lw: [0, 1],
      pullStart: flat ? 16 : 22,
      pullEnd: 0,
      done: () => this.sharpen(hero),
    };
    return true;
  }

  // one flight back to the slot, the shelf copy takes over at the hand-off so motion and shadow never stop
  close() {
    if (!this.hero || this._busy) return;
    if (this._mode === "reader") {
      this.closeReader(() => this.close());
      return;
    }
    const hero = this.hero;
    const s = this.d.books.get(hero.id)!;
    this._busy = true;
    this.setMode("shelf", null);
    const flight: Tween = {
      ...this.from(hero),
      to: () => ({ pos: s.tPos, quat: s.tQuat }),
      dur: this.dur(0.8, 0.3),
      lw: [hero.lw, 0],
      pullStart: 0,
      pullEnd: this.d.poseOf(hero.id) === "flat" ? 18 : 24,
      until: HANDOFF,
    };
    flight.done = () => {
      const P = tweenPose(flight, flight.t);
      place(s, P.pos, P.quat);
      s.ret = { ...flight, until: undefined, done: undefined };
      s.inHand = false;
      syncVisible(s);
      this.remove(hero);
      this.hero = null;
      this._busy = false;
      this.d.invalidateShelf();
    };
    hero.tween = flight;
  }

  // slides the current book out and the previous or next on-shelf book in
  step(dir: 1 | -1) {
    const old = this.hero;
    if (!old || this._mode !== "detail" || this._busy) return;
    const onShelf = this.d
      .order()
      .filter(
        (id) =>
          id === old.id ||
          (this.d.books.get(id) && !this.d.books.get(id)!.offShelf),
      );
    const i = onShelf.indexOf(old.id);
    const nextId = onShelf[(i + dir + onShelf.length) % onShelf.length];

    const oldS = this.d.books.get(old.id)!;
    oldS.inHand = false;
    syncVisible(oldS);
    this.d.invalidateShelf();
    old.leaving = true;
    const off = new THREE.Vector3(
      -dir * this.d.cam.viewWidthAt(old.group.position) * 0.9,
      0,
      0,
    );
    const turned = (sign: number, q: THREE.Quaternion) =>
      new THREE.Quaternion().setFromAxisAngle(UP, sign * dir * 0.6).multiply(q);
    old.tween = {
      ...this.from(old),
      to: () => {
        const t = this.target("detail", old.id);
        return { pos: t.pos.add(off), quat: turned(-1, t.quat) };
      },
      dur: 0.5,
      pullStart: 0,
      pullEnd: 0,
      done: () => {
        this.remove(old);
        this.outgoing = this.outgoing.filter((h) => h !== old);
      },
    };
    this.outgoing.push(old);

    const hero = this.make(nextId);
    hero.lw = 1;
    const target = this.target("detail", nextId);
    hero.group.position.copy(target.pos).sub(off);
    hero.group.quaternion.copy(turned(1, target.quat));
    const nextS = this.d.books.get(nextId)!;
    nextS.inHand = true;
    syncVisible(nextS);
    hero.tween = {
      ...this.from(hero),
      to: () => this.target("detail", nextId),
      dur: 0.5,
      ease: easeOut,
      pullStart: 0,
      pullEnd: 0,
      done: () => this.sharpen(hero),
    };
    this.hero = hero;
    this.d.cb.onMode("detail", nextId);
  }

  openReader() {
    const hero = this.hero;
    if (!hero || this._mode !== "detail" || this._busy) return;
    this.setMode("reader", hero.id);
    hero.tween = {
      ...this.from(hero),
      to: () => this.target("reader", hero.id),
      dur: this.dur(0.75, 0.2),
      pullStart: 0,
      pullEnd: 0,
      done: () => {
        hero.coverTarget = -Math.PI * 0.86;
      },
    };
  }

  // shuts the cover first, then flies back to the detail slot
  closeReader(after?: () => void) {
    const hero = this.hero;
    if (!hero || this._mode !== "reader") return;
    hero.coverTarget = 0;
    this.setMode("detail", hero.id);
    this._busy = true;
    const wait = () => {
      if (Math.abs(hero.cover) > 0.05) {
        requestAnimationFrame(wait);
        return;
      }
      hero.tween = {
        ...this.from(hero),
        to: () => this.target("detail", hero.id),
        dur: this.dur(0.7, 0.2),
        pullStart: 0,
        pullEnd: 0,
        done: () => {
          this._busy = false;
          after?.();
        },
      };
    };
    wait();
  }

  // advances every close-up book, returns true when the hero canvas needs a render
  tick(dt: number) {
    this.time += dt;
    let active = false;
    for (const h of [this.hero, ...this.outgoing]) {
      if (!h) continue;
      active = true;
      this.stepHero(h, dt);
    }
    const render = active || this.dirty;
    this.dirty = false;
    return render;
  }

  // compiles the close-up's pipelines at load so the first tap does not pay for shader compilation
  async warmUp(renderer: Renderer) {
    const camera = this.d.cam.camera;
    try {
      const h = this.make(BOOKS[0].id);
      h.group.position.set(0, camera.position.y, camera.position.z - 300);
      await precompile(renderer, this.scene, camera);
      this.remove(h);
      renderer.render(this.scene, camera);
    } catch {
      // warm-up is best effort
    }
  }

  dispose() {
    this.disposed = true;
  }

  private stepHero(h: Hero, dt: number) {
    const g = h.group;
    if (h === this.hero) this.d.aimLights(g.quaternion, h.lw);
    if (h.tween) {
      const tw = h.tween;
      const end = tw.until ?? 1;
      tw.t = Math.min(end, tw.t + dt / tw.dur);
      const P = tweenPose(tw, tw.t);
      // the light blend completes by the hand-off point
      if (tw.lw)
        h.lw = THREE.MathUtils.lerp(
          tw.lw[0],
          tw.lw[1],
          (tw.ease ?? easeInOut)(Math.min(1, tw.t / end)),
        );
      g.position.copy(P.pos);
      g.quaternion.copy(P.quat);
      if (tw.t >= end) {
        h.tween = null;
        tw.done?.();
      }
    } else if (!h.leaving && this._mode !== "shelf" && h === this.hero) {
      // idle in the hand: follow the slot through resizes with a gentle float
      const t = this.target(this._mode, h.id);
      const sway = this._mode === "detail" && !this.d.reduced ? 1 : 0;
      t.pos.y += Math.sin(this.time * 1.1) * 0.25 * sway;
      const q = new THREE.Quaternion()
        .setFromAxisAngle(UP, Math.sin(this.time * 0.7) * 0.05 * sway)
        .multiply(t.quat);
      g.position.lerp(t.pos, 1 - Math.exp(-10 * dt));
      g.quaternion.slerp(q, 1 - Math.exp(-10 * dt));
    }
    // the front board swings on its hinge towards its target angle
    if (h.cover !== h.coverTarget) {
      const speed = this.d.reduced ? 12 : 4.2;
      h.cover += (h.coverTarget - h.cover) * (1 - Math.exp(-speed * dt));
      if (Math.abs(h.coverTarget - h.cover) < 0.002) h.cover = h.coverTarget;
      h.pivot.rotation.y = h.cover;
    }
  }

  // swaps in close-up resolution art one texture per frame once the book is still
  private sharpen(h: Hero) {
    if (h.sharp) return;
    h.sharp = true;
    const A = this.art.get(h.id, ART_SHARP);
    const jobs: [SharpSlot, HTMLCanvasElement][] = [
      ["cover", A.cover],
      ["spine", A.spine],
      ["title", A.title],
      ["end", A.end],
    ];
    const next = () => {
      const job = jobs.shift();
      if (!job || this.disposed || !h.group.parent) return;
      swapArt(h, job[0], job[1]);
      this.dirty = true;
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }

  private make(id: string) {
    const h = createHero(id, this.art.get(id, ART_FAST));
    this.scene.add(h.group);
    this.dirty = true;
    return h;
  }

  private remove(h: Hero) {
    this.scene.remove(h.group);
    h.dispose();
    this.dirty = true;
  }

  private setMode(mode: Mode, id: string | null) {
    this._mode = mode;
    this.d.cb.onMode(mode, id);
  }

  private target(mode: Mode, id: string) {
    return heroTarget(
      this.d.cam,
      mode,
      id,
      this.d.cb.getSlot(mode),
      this.d.root.getBoundingClientRect(),
    );
  }

  // a tween's starting point is wherever the book is now
  private from(h: Hero): { from: PoseLike; t: number } {
    return {
      from: { pos: h.group.position.clone(), quat: h.group.quaternion.clone() },
      t: 0,
    };
  }

  private dur(full: number, reduced: number) {
    return this.d.reduced ? reduced : full;
  }
}
