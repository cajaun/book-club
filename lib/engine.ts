// The shelf engine. Owns two GPU canvases:
//   - `shelf`: the bookcase. Rendered on demand (only while something moves).
//   - `hero`:  a transparent canvas above the DOM blur layer that holds the one
//              book being looked at. Same camera, so the hand-off from shelf
//              to hero is pixel-identical and the flight starts from the slot.
// Renderer: three.js WebGPURenderer — WebGPU where available, automatic
// WebGL2 fallback everywhere else (append ?webgl to force the fallback).

import * as THREE from "three/webgpu";
import { BOOKS, BOOK_BY_ID, INITIAL_SHELVES, ROMAN, SHELVES, type Entry, type Pose } from "./books";
import { CASE, freeSpace, interiorTop, layoutAll, layoutShelf, poseQuat, surfaceY, type Target } from "./layout";
import {
  buildAtlas,
  drawBack,
  drawBackWall,
  drawCover,
  drawEndpaper,
  drawPages,
  drawPlaque,
  drawSpine,
  drawTitlePage,
  drawWood,
  makeCanvas,
  type Atlas,
  type Fonts,
} from "./textures";

export type Mode = "shelf" | "detail" | "reader";

export interface EngineCallbacks {
  onHandle(id: string | null, pose: Pose | null): void;
  onMode(mode: Mode, id: string | null): void;
  onHeaderRect(r: { x: number; y: number; w: number; h: number }): void;
  onBackend(name: string): void;
  onLost(): void;
  getSlot(mode: Mode): DOMRect | null;
}

interface BookState {
  id: string;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  tPos: THREE.Vector3;
  tQuat: THREE.Quaternion;
  follow: boolean; // dragged: track the pointer tightly
}

interface Hero {
  id: string;
  group: THREE.Group;
  pivot: THREE.Object3D;
  dispose(): void;
  cover: number; // current cover angle
  coverTarget: number;
  tween: Tween | null;
  leaving?: boolean;
}

interface Tween {
  from: { pos: THREE.Vector3; quat: THREE.Quaternion };
  to: () => { pos: THREE.Vector3; quat: THREE.Quaternion };
  t: number;
  dur: number;
  pullStart: number; // cm the book slides towards the reader before turning
  pullEnd: number;
  done?: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class LibraryEngine {
  private shelfR!: THREE.WebGPURenderer;
  private heroR!: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private heroScene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(20, 1, 10, 3000);
  private atlas!: Atlas;
  private bookMat!: THREE.MeshStandardMaterial;
  private books = new Map<string, BookState>();
  private meshes: THREE.Mesh[] = [];
  private shelves: Entry[][] = INITIAL_SHELVES.map((s) => s.map((e) => (e.kind === "stack" ? { ...e, ids: [...e.ids] } : { ...e })));
  private ray = new THREE.Raycaster();
  private key!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private fill!: THREE.DirectionalLight;
  private size = { w: 1, h: 1 };
  private dirty = true;
  private heroDirty = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  private disposed = false;
  private hover: string | null = null;
  private handled: string | null = null;
  private handleTimer: ReturnType<typeof setTimeout> | null = null;
  private mode: Mode = "shelf";
  private hero: Hero | null = null;
  private outgoing: Hero[] = [];
  private busy = false; // a return flight is in progress
  private reduced = false;
  private ro?: ResizeObserver;
  private down: {
    id: string | null;
    x: number;
    y: number;
    pointerId: number;
    active: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null = null;
  private drag: {
    id: string;
    entry: Entry;
    offset: THREE.Vector2;
    target: { shelf: number; index: number; stack?: number };
    vx: number;
    lastX: number;
  } | null = null;

  constructor(
    private root: HTMLElement,
    private shelfCanvas: HTMLCanvasElement,
    private heroCanvas: HTMLCanvasElement,
    private fonts: Fonts,
    private cb: EngineCallbacks,
  ) {}

  // ------------------------------------------------------------------ setup

  async init() {
    const forceWebGL = typeof location !== "undefined" && /[?&]webgl\b/.test(location.search);
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.shelfR = await this.makeRenderer(this.shelfCanvas, forceWebGL);
    this.heroR = await this.makeRenderer(this.heroCanvas, forceWebGL);
    this.shelfR.shadowMap.enabled = true;
    this.shelfR.shadowMap.type = THREE.PCFShadowMap;
    const backend = (this.shelfR.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2";
    this.cb.onBackend(backend);
    if (/[?&]debug\b/.test(location.search)) (window as unknown as { __shelf: unknown }).__shelf = this;

    this.buildFurniture();
    this.buildBooks();
    this.buildLights();
    this.buildHeroLights();
    this.relayout(true);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
    this.resize();
    this.bindPointer();
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
    };
    this.raf = requestAnimationFrame(loop);
  }

  private async makeRenderer(canvas: HTMLCanvasElement, forceWebGL: boolean) {
    const r = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL });
    await r.init();
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.NoToneMapping;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    (r as unknown as { onDeviceLost: () => void }).onDeviceLost = () => this.cb.onLost();
    canvas.addEventListener("webglcontextlost", () => this.cb.onLost());
    return r;
  }

  private canvasTex(c: HTMLCanvasElement, flipY = true) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = flipY;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  private buildFurniture() {
    const woodC = drawWood(1024, 512, "wood");
    const woodH = this.canvasTex(woodC);
    woodH.wrapS = woodH.wrapT = THREE.RepeatWrapping;
    const woodV = woodH.clone();
    woodV.center.set(0.5, 0.5);
    woodV.rotation = Math.PI / 2;
    woodV.needsUpdate = true;
    const wood = new THREE.MeshStandardMaterial({ map: woodH, roughness: 0.62, color: 0xffffff });
    const woodSide = new THREE.MeshStandardMaterial({ map: woodV, roughness: 0.62 });
    const woodDark = new THREE.MeshStandardMaterial({ map: woodH, roughness: 0.7, color: 0x9a8070 });

    const { W, board, depth, side, crown, plinth } = CASE;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };

    // shelf boards (one under each compartment)
    for (let i = 0; i < CASE.shelves; i++) {
      add(new THREE.BoxGeometry(W, board, depth + 1), wood, 0, surfaceY(i) - board / 2, -depth / 2 + 0.5);
    }
    const topY = interiorTop;
    add(new THREE.BoxGeometry(W, board, depth + 1), woodDark, 0, topY + board / 2, -depth / 2 + 0.5);

    // sides
    const totalTop = topY + board + crown;
    const totalBot = -board - plinth;
    const sideH = totalTop - totalBot;
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(side, sideH, depth + 3), woodSide, s * (W / 2 + side / 2), totalBot + sideH / 2, -depth / 2 + 1.5);
    }
    // crown (the header board) + cornice
    add(new THREE.BoxGeometry(W + side * 2, crown, depth + 3), wood, 0, topY + board + crown / 2, -depth / 2 + 1.5);
    add(new THREE.BoxGeometry(W + side * 2 + 5, 2.4, depth + 6), woodDark, 0, totalTop + 1.2, -depth / 2 + 2);
    add(new THREE.BoxGeometry(W, 1.6, 1.6), woodDark, 0, topY + board + 0.8, 1.2);
    // plinth
    add(new THREE.BoxGeometry(W + side * 2 + 2, plinth, depth + 4), woodDark, 0, totalBot + plinth / 2, -depth / 2 + 2);

    // back wall
    const wallTex = this.canvasTex(drawBackWall(1024, 2048));
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(W, topY),
      new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }),
    );
    wall.position.set(0, topY / 2, -depth);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // brass shelf plaques
    SHELVES.forEach((name, i) => {
      const tex = this.canvasTex(drawPlaque(`${ROMAN[i]}  ·  ${name.toUpperCase()}`, this.fonts, 2));
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0, color: 0x9c8b74, transparent: true });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(30, 30 * (56 / 512)), mat);
      p.position.set(0, surfaceY(i) - board / 2, 1.12);
      this.scene.add(p);
    });

    // floor shadow catcher in front of the case (desktop shows the room)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 300),
      new THREE.MeshStandardMaterial({ color: 0x040302, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, totalBot, 100);
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private buildBooks() {
    this.atlas = buildAtlas(BOOKS, this.fonts, 4096);
    const tex = this.canvasTex(this.atlas.canvas, false);
    this.bookMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 });
    for (const b of BOOKS) {
      const geo = bookGeometry(b.id, this.atlas);
      const mesh = new THREE.Mesh(geo, this.bookMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.id = b.id;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      this.books.set(b.id, {
        id: b.id,
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        tPos: new THREE.Vector3(),
        tQuat: new THREE.Quaternion(),
        follow: false,
      });
    }
  }

  private buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffe9cc, 0x2a1a10, 1.35);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xffe0b0, 2.6);
    key.position.set(70, 170, 460);
    key.target.position.set(0, interiorTop / 2, -CASE.depth / 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -68;
    sc.right = 68;
    sc.top = 128;
    sc.bottom = -128;
    sc.near = 300;
    sc.far = 640;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 3;
    this.scene.add(key, key.target);
    this.key = key;
    this.fill = new THREE.DirectionalLight(0xfff2e0, 0.75);
    this.fill.position.set(-60, 80, 400);
    this.scene.add(this.fill);
  }

  private buildHeroLights() {
    this.heroScene.add(new THREE.HemisphereLight(0xfff1dc, 0x302018, 1.6));
    const k = new THREE.DirectionalLight(0xfff0d8, 2.2);
    k.position.set(-1, 1.4, 2);
    this.heroScene.add(k);
    const rim = new THREE.DirectionalLight(0xffd9a0, 0.8);
    rim.position.set(2, 0.5, -0.5);
    this.heroScene.add(rim);
  }

  setLamp(on: boolean) {
    this.key.intensity = on ? 2.6 : 0.55;
    this.key.color.set(on ? 0xffe0b0 : 0x9fb4d8);
    this.hemi.intensity = on ? 1.35 : 0.45;
    this.fill.intensity = on ? 0.75 : 0.25;
    this.dirty = true;
  }

  // ------------------------------------------------------------------ layout

  private relayout(snap = false) {
    const ph = this.drag && this.drag.target.stack === undefined ? { shelf: this.drag.target.shelf, index: this.drag.target.index, entry: this.drag.entry } : undefined;
    const { targets } = layoutAll(this.shelves, ph);
    targets.forEach((t: Target, id) => {
      const s = this.books.get(id)!;
      s.tPos.copy(t.pos);
      s.tQuat.copy(t.quat);
      if (snap) {
        s.pos.copy(t.pos);
        s.quat.copy(t.quat);
      }
    });
    this.dirty = true;
  }

  private locate(id: string): { shelf: number; index: number; k: number } | null {
    for (let s = 0; s < this.shelves.length; s++) {
      const list = this.shelves[s];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.kind === "book" && e.id === id) return { shelf: s, index: i, k: -1 };
        if (e.kind === "stack") {
          const k = e.ids.indexOf(id);
          if (k >= 0) return { shelf: s, index: i, k };
        }
      }
    }
    return null;
  }

  poseOf(id: string): Pose {
    const loc = this.locate(id);
    if (!loc) {
      if (this.drag?.id === id) return this.drag.entry.kind === "stack" ? "flat" : (this.drag.entry as { pose: Pose }).pose;
      return "spine";
    }
    const e = this.shelves[loc.shelf][loc.index];
    return e.kind === "book" ? e.pose : "flat";
  }

  /** Change how a book sits: spine out, face out, or laid flat. */
  setPose(id: string, pose: Pose) {
    const loc = this.locate(id);
    if (!loc) return;
    const list = this.shelves[loc.shelf];
    const e = list[loc.index];
    if (e.kind === "book") {
      if (pose === "flat") list[loc.index] = { kind: "stack", ids: [id] };
      else e.pose = pose;
    } else if (e.kind === "stack") {
      if (pose === "flat") return;
      if (e.ids.length === 1) list[loc.index] = { kind: "book", id, pose };
      else {
        e.ids.splice(loc.k, 1);
        list.splice(loc.index + 1, 0, { kind: "book", id, pose });
      }
    }
    // give the move a little lift so turning books clear their neighbours
    const s = this.books.get(id)!;
    s.vel.z += 40;
    s.vel.y += 25;
    this.relayout();
    this.setHandled(id);
  }

  private setHandled(id: string | null) {
    this.handled = id;
    if (this.handleTimer) clearTimeout(this.handleTimer);
    if (id) this.handleTimer = setTimeout(() => this.setHandled(this.drag || this.down ? id : null), 5000);
    this.cb.onHandle(id, id ? this.poseOf(id) : null);
  }

  keepHandle() {
    if (this.handled) this.setHandled(this.handled);
  }

  // ------------------------------------------------------------------ resize / camera

  private resize() {
    const r = this.root.getBoundingClientRect();
    this.size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    const aspect = this.size.w / this.size.h;
    this.shelfR.setSize(this.size.w, this.size.h, false);
    this.heroR.setSize(this.size.w, this.size.h, false);
    this.camera.aspect = aspect;
    const fov = this.camera.fov * (Math.PI / 180);
    const top = interiorTop + CASE.board + CASE.crown + 2.4;
    const bot = -CASE.board - CASE.plinth;
    const totalH = top - bot;
    // fit the whole case vertically; on very narrow screens keep ~92cm visible
    // (the sides crop exactly like the reference)
    const viewH = Math.max(totalH + 4, 92 / aspect);
    const dist = viewH / 2 / Math.tan(fov / 2);
    this.camera.position.set(0, (top + bot) / 2, dist);
    this.camera.lookAt(0, (top + bot) / 2, 0);
    this.camera.near = 10;
    this.camera.far = dist + 400;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // tell the DOM where the crown board is so the header sits on it
    const a = this.project(new THREE.Vector3(-(CASE.W / 2 + CASE.side), top - 2.4, 1.5));
    const b = this.project(new THREE.Vector3(CASE.W / 2 + CASE.side, interiorTop + CASE.board, 1.5));
    this.cb.onHeaderRect({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
    this.dirty = true;
    this.heroDirty = true;
  }

  private project(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.size.w, y: ((1 - p.y) / 2) * this.size.h };
  }

  private ndc(cx: number, cy: number) {
    return new THREE.Vector2((cx / this.size.w) * 2 - 1, -(cy / this.size.h) * 2 + 1);
  }

  private pointOnPlane(cx: number, cy: number, z: number) {
    this.ray.setFromCamera(this.ndc(cx, cy), this.camera);
    const p = new THREE.Vector3();
    this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), p);
    return p;
  }

  private pick(cx: number, cy: number): string | null {
    this.ray.setFromCamera(this.ndc(cx, cy), this.camera);
    const hit = this.ray.intersectObjects(this.meshes.filter((m) => m.visible), false)[0];
    return hit ? (hit.object.userData.id as string) : null;
  }

  // ------------------------------------------------------------------ pointer

  private bindPointer() {
    const el = this.root;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    el.addEventListener("pointerdown", (e) => {
      if (this.mode !== "shelf" || this.busy || e.button !== 0) return;
      // only the shelf itself; the header and panels handle their own input
      if (e.target !== this.shelfCanvas && e.target !== el) return;
      const p = local(e);
      const id = this.pick(p.x, p.y);
      this.down = { id, x: p.x, y: p.y, pointerId: e.pointerId, active: false, timer: null };
      if (id) {
        el.setPointerCapture(e.pointerId);
        // long-press also picks a book up (touch-friendly)
        this.down.timer = setTimeout(() => {
          if (this.down && !this.down.active && this.down.id) this.startDrag(this.down.x, this.down.y);
        }, 380);
      }
    });
    el.addEventListener("pointermove", (e) => {
      const p = local(e);
      if (this.down) {
        if (!this.down.active && this.down.id && Math.hypot(p.x - this.down.x, p.y - this.down.y) > 6) this.startDrag(p.x, p.y);
        if (this.down?.active) this.moveDrag(p.x, p.y);
        return;
      }
      if (this.mode !== "shelf" || this.busy) return;
      const id = e.pointerType === "mouse" ? this.pick(p.x, p.y) : null;
      this.setHover(id);
    });
    const up = (e: PointerEvent, cancelled = false) => {
      const d = this.down;
      if (!d) return;
      if (d.timer) clearTimeout(d.timer);
      this.down = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (d.active) {
        this.endDrag();
        return;
      }
      if (cancelled) return;
      if (!d.id) {
        this.setHandled(null);
        return;
      }
      if (d.id === this.handled) {
        // tap a handled book to cycle how it sits
        const pose = this.poseOf(d.id);
        this.setPose(d.id, pose === "flat" ? "spine" : pose === "spine" ? "face" : "flat");
      } else {
        this.setHandled(null);
        this.open(d.id);
      }
    };
    el.addEventListener("pointerup", (e) => up(e));
    el.addEventListener("pointercancel", (e) => up(e, true));
    el.addEventListener("pointerleave", () => {
      if (!this.down) this.setHover(null);
    });
  }

  setHover(id: string | null) {
    if (this.hover === id) return;
    this.hover = id;
    this.root.style.cursor = id ? "grab" : "";
    this.dirty = true;
  }

  private startDrag(cx: number, cy: number) {
    const d = this.down;
    if (!d || !d.id) return;
    const id = d.id;
    const loc = this.locate(id);
    if (!loc) return;
    d.active = true;
    if (d.timer) clearTimeout(d.timer);
    const list = this.shelves[loc.shelf];
    const e = list[loc.index];
    let entry: Entry;
    let index = loc.index;
    if (e.kind === "stack") {
      e.ids.splice(loc.k, 1);
      entry = { kind: "stack", ids: [id] };
      if (e.ids.length === 0) list.splice(loc.index, 1);
      else index = loc.index + 1;
    } else {
      entry = list.splice(loc.index, 1)[0];
    }
    const s = this.books.get(id)!;
    const p = this.pointOnPlane(cx, cy, 6);
    this.drag = {
      id,
      entry,
      offset: new THREE.Vector2(s.pos.x - p.x, s.pos.y - p.y),
      target: { shelf: loc.shelf, index },
      vx: 0,
      lastX: p.x,
    };
    s.follow = true;
    this.setHover(null);
    this.root.style.cursor = "grabbing";
    this.setHandled(id);
    this.moveDrag(cx, cy);
  }

  private moveDrag(cx: number, cy: number) {
    const dr = this.drag;
    if (!dr) return;
    const s = this.books.get(dr.id)!;
    const p = this.pointOnPlane(cx, cy, 6);
    const bx = THREE.MathUtils.clamp(p.x + dr.offset.x, -CASE.W / 2 + 2, CASE.W / 2 - 2);
    const by = THREE.MathUtils.clamp(p.y + dr.offset.y, -2, interiorTop + 4);
    dr.vx = THREE.MathUtils.lerp(dr.vx, p.x - dr.lastX, 0.35);
    dr.lastX = p.x;

    // which shelf / where in it
    let shelf = 0;
    let best = Infinity;
    for (let i = 0; i < CASE.shelves; i++) {
      const mid = surfaceY(i) + CASE.compH / 2;
      const dd = Math.abs(by - mid);
      if (dd < best) {
        best = dd;
        shelf = i;
      }
    }
    // a full shelf won't take another book: keep the last shelf that had room
    if (shelf !== dr.target.shelf && dr.entry.kind !== "stack" && freeSpace(this.shelves[shelf], dr.entry) < 0) shelf = dr.target.shelf;
    if (shelf !== dr.target.shelf && dr.entry.kind === "stack" && freeSpace(this.shelves[shelf], dr.entry) < 0) {
      // a flat book can still go onto an existing stack, so only block if no stack is under the pointer
      const hasStack = this.shelves[shelf].some((e) => e.kind === "stack");
      if (!hasStack) shelf = dr.target.shelf;
    }
    const tmp = new Map<string, Target>();
    const spans = layoutShelf(this.shelves[shelf], shelf, tmp);
    let index = this.shelves[shelf].length;
    let stack: number | undefined;
    for (const sp of spans) {
      if (sp.kind === "stack" && dr.entry.kind === "stack") {
        const inset = (sp.x1 - sp.x0) * 0.22;
        if (bx > sp.x0 + inset && bx < sp.x1 - inset) {
          stack = sp.index;
          break;
        }
      }
      if ((sp.x0 + sp.x1) / 2 > bx) {
        index = sp.index;
        break;
      }
    }
    const t = dr.target;
    if (t.shelf !== shelf || t.index !== index || t.stack !== stack) {
      dr.target = { shelf, index, stack };
      this.relayout();
    }

    // lifted, tilted with the motion, held slightly towards the reader
    const pose: Pose = dr.entry.kind === "book" ? dr.entry.pose : "flat";
    const tilt = THREE.MathUtils.clamp(-dr.vx * 0.09, -0.45, 0.45) + (pose === "flat" ? 0 : -0.12);
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, 0.12))
      .multiply(poseQuat(pose));
    const b = BOOK_BY_ID[dr.id];
    const depth = pose === "face" ? b.t : b.d;
    s.tPos.set(bx, by, 7 - depth / 2);
    s.tQuat.copy(q);
    this.dirty = true;
  }

  private endDrag() {
    const dr = this.drag;
    if (!dr) return;
    const list = this.shelves[dr.target.shelf];
    if (dr.target.stack !== undefined) {
      const st = list[dr.target.stack];
      if (st && st.kind === "stack") st.ids.push(dr.id);
      else list.splice(dr.target.index, 0, dr.entry);
    } else {
      list.splice(Math.min(dr.target.index, list.length), 0, dr.entry);
    }
    this.books.get(dr.id)!.follow = false;
    this.drag = null;
    this.root.style.cursor = "";
    this.relayout();
    this.setHandled(dr.id);
  }

  // ------------------------------------------------------------------ hero (selected book)

  private heroTarget(mode: Mode, id: string) {
    const b = BOOK_BY_ID[id];
    const rect = this.cb.getSlot(mode);
    const rootR = this.root.getBoundingClientRect();
    const cx = rect ? rect.left - rootR.left + rect.width / 2 : this.size.w / 2;
    const cy = rect ? rect.top - rootR.top + rect.height / 2 : this.size.h * 0.35;
    const rh = rect ? rect.height : this.size.h * 0.4;
    const rw = rect ? rect.width : this.size.w * 0.6;
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const H = this.size.h;
    const wEff = mode === "reader" ? b.d : b.d * 0.98 + b.t * 0.24;
    const dist = Math.max((b.h * H) / (rh * 2 * tan), (wEff * H) / (rw * 2 * tan));
    this.ray.setFromCamera(this.ndc(cx, cy), this.camera);
    const dir = this.ray.ray.direction.clone();
    const fwd = new THREE.Vector3(0, 0, -1);
    const pos = this.camera.position.clone().addScaledVector(dir, dist / dir.dot(fwd));
    const yaw = mode === "reader" ? -Math.PI / 2 : -Math.PI / 2 + 0.27;
    const pitch = mode === "reader" ? 0 : -0.04;
    // turn the book to face the eye (not just the screen plane), so a book
    // placed above centre doesn't show its bottom edge
    const toCam = this.camera.position.clone().sub(pos);
    const faceCam = new THREE.Quaternion()
      .setFromAxisAngle(UP, Math.atan2(toCam.x, toCam.z))
      .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, -Math.atan2(toCam.y, Math.hypot(toCam.x, toCam.z))));
    const quat = faceCam
      .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, pitch))
      .multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    return { pos, quat };
  }

  open(id: string) {
    if (this.mode !== "shelf" || this.busy) return;
    const s = this.books.get(id);
    if (!s) return;
    this.setHover(null);
    const hero = this.makeHero(id);
    hero.group.position.copy(s.pos);
    hero.group.quaternion.copy(s.quat);
    s.mesh.visible = false;
    this.hero = hero;
    this.mode = "detail";
    this.cb.onMode("detail", id);
    this.dirty = true;
    const flat = this.poseOf(id) === "flat";
    hero.tween = {
      from: { pos: s.pos.clone(), quat: s.quat.clone() },
      to: () => this.heroTarget("detail", id),
      t: 0,
      dur: this.reduced ? 0.25 : 1.0,
      pullStart: flat ? 16 : 22,
      pullEnd: 0,
    };
  }

  close() {
    if (!this.hero || this.busy) return;
    if (this.mode === "reader") {
      this.closeReader(() => this.close());
      return;
    }
    const hero = this.hero;
    const id = hero.id;
    const s = this.books.get(id)!;
    this.busy = true;
    this.mode = "shelf";
    this.cb.onMode("shelf", null);
    hero.tween = {
      from: { pos: hero.group.position.clone(), quat: hero.group.quaternion.clone() },
      to: () => ({ pos: s.tPos, quat: s.tQuat }),
      t: 0,
      dur: this.reduced ? 0.25 : 0.95,
      pullStart: 0,
      pullEnd: this.poseOf(id) === "flat" ? 16 : 22,
      done: () => {
        s.pos.copy(s.tPos);
        s.quat.copy(s.tQuat);
        s.vel.set(0, 0, 0);
        s.mesh.visible = true;
        this.removeHero(hero);
        this.hero = null;
        this.busy = false;
        this.dirty = true;
        this.heroDirty = true;
      },
    };
  }

  /** Step to the previous / next book in shelf order while the detail view is open. */
  step(dir: 1 | -1) {
    if (!this.hero || this.mode !== "detail" || this.busy) return;
    const order: string[] = [];
    this.shelves.forEach((list) =>
      list.forEach((e) => {
        if (e.kind === "book") order.push(e.id);
        else if (e.kind === "stack") order.push(...e.ids.slice().reverse());
      }),
    );
    const i = order.indexOf(this.hero.id);
    const nextId = order[(i + dir + order.length) % order.length];
    const old = this.hero;
    this.books.get(old.id)!.mesh.visible = true;
    this.dirty = true;
    old.leaving = true;
    const off = new THREE.Vector3(-dir * this.viewWidthAt(old.group.position) * 0.9, 0, 0);
    old.tween = {
      from: { pos: old.group.position.clone(), quat: old.group.quaternion.clone() },
      to: () => {
        const t = this.heroTarget("detail", old.id);
        return { pos: t.pos.add(off), quat: new THREE.Quaternion().setFromAxisAngle(UP, -dir * 0.6).multiply(t.quat) };
      },
      t: 0,
      dur: 0.5,
      pullStart: 0,
      pullEnd: 0,
      done: () => {
        this.removeHero(old);
        this.outgoing = this.outgoing.filter((h) => h !== old);
      },
    };
    this.outgoing.push(old);

    const hero = this.makeHero(nextId);
    const target = this.heroTarget("detail", nextId);
    hero.group.position.copy(target.pos).sub(off);
    hero.group.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(UP, dir * 0.6).multiply(target.quat));
    this.books.get(nextId)!.mesh.visible = false;
    hero.tween = {
      from: { pos: hero.group.position.clone(), quat: hero.group.quaternion.clone() },
      to: () => this.heroTarget("detail", nextId),
      t: 0,
      dur: 0.55,
      pullStart: 0,
      pullEnd: 0,
    };
    this.hero = hero;
    this.cb.onMode("detail", nextId);
  }

  openReader() {
    const hero = this.hero;
    if (!hero || this.mode !== "detail" || this.busy) return;
    this.mode = "reader";
    this.cb.onMode("reader", hero.id);
    hero.tween = {
      from: { pos: hero.group.position.clone(), quat: hero.group.quaternion.clone() },
      to: () => this.heroTarget("reader", hero.id),
      t: 0,
      dur: this.reduced ? 0.2 : 0.75,
      pullStart: 0,
      pullEnd: 0,
      done: () => {
        hero.coverTarget = -Math.PI * 0.86;
      },
    };
  }

  closeReader(after?: () => void) {
    const hero = this.hero;
    if (!hero || this.mode !== "reader") return;
    hero.coverTarget = 0;
    this.mode = "detail";
    this.cb.onMode("detail", hero.id);
    this.busy = true;
    const wait = () => {
      if (Math.abs(hero.cover) > 0.05) {
        requestAnimationFrame(wait);
        return;
      }
      hero.tween = {
        from: { pos: hero.group.position.clone(), quat: hero.group.quaternion.clone() },
        to: () => this.heroTarget("detail", hero.id),
        t: 0,
        dur: this.reduced ? 0.2 : 0.7,
        pullStart: 0,
        pullEnd: 0,
        done: () => {
          this.busy = false;
          after?.();
        },
      };
    };
    wait();
  }

  private viewWidthAt(p: THREE.Vector3) {
    const dist = this.camera.position.z - p.z;
    return 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
  }

  private makeHero(id: string): Hero {
    const b = BOOK_BY_ID[id];
    const D = 40; // px per cm for close-up art
    const board = 0.28;
    const over = 0.3;
    const tex: THREE.Texture[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const mats: THREE.Material[] = [];
    const T = (c: HTMLCanvasElement) => {
      const t = this.canvasTex(c);
      tex.push(t);
      return t;
    };
    const M = (o: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardMaterial({ roughness: 0.72, ...o });
      mats.push(m);
      return m;
    };
    const G = (g: THREE.BufferGeometry) => (geos.push(g), g);

    const coverC = makeCanvas(b.d * D, b.h * D);
    drawCover(coverC.getContext("2d")!, 0, 0, coverC.width, coverC.height, b, this.fonts);
    const spineC = makeCanvas(Math.max(8, b.t * D), b.h * D);
    drawSpine(spineC.getContext("2d")!, 0, 0, spineC.width, spineC.height, b, this.fonts);
    const backC = makeCanvas(256, 256);
    drawBack(backC.getContext("2d")!, 0, 0, 256, 256, b);
    const pagesC = makeCanvas(256, 256);
    drawPages(pagesC.getContext("2d")!, 0, 0, 256, 256, b.id);
    const titleC = makeCanvas((b.d - over - board) * D, (b.h - over * 2) * D);
    drawTitlePage(titleC.getContext("2d")!, titleC.width, titleC.height, b, this.fonts);
    const endC = makeCanvas(512, 768);
    drawEndpaper(endC.getContext("2d")!, 512, 768, b);

    const boardM = M({ color: b.base });
    const coverM = M({ map: T(coverC), roughness: 0.6 });
    const spineM = M({ map: T(spineC), roughness: 0.6 });
    const backM = M({ map: T(backC) });
    const pagesM = M({ map: T(pagesC), roughness: 0.9 });
    const titleM = M({ map: T(titleC), roughness: 0.92 });
    const endM = M({ map: T(endC), roughness: 0.8 });

    const group = new THREE.Group();
    const { t, h, d } = b;
    // BoxGeometry material order: +x, -x, +y, -y, +z, -z
    const spine = new THREE.Mesh(G(new THREE.BoxGeometry(t, h, board)), [boardM, boardM, boardM, boardM, spineM, boardM]);
    spine.position.set(0, 0, d / 2 - board / 2);
    const back = new THREE.Mesh(G(new THREE.BoxGeometry(board, h, d - board)), [endM, backM, boardM, boardM, boardM, boardM]);
    back.position.set(-t / 2 + board / 2, 0, -board / 2);
    const pd = d - board - over;
    const pages = new THREE.Mesh(G(new THREE.BoxGeometry(t - board * 2, h - over * 2, pd)), [titleM, pagesM, pagesM, pagesM, pagesM, pagesM]);
    pages.position.set(0, 0, (over - board) / 2);
    const pivot = new THREE.Object3D();
    pivot.position.set(t / 2 - board / 2, 0, d / 2 - board);
    const cover = new THREE.Mesh(G(new THREE.BoxGeometry(board, h, d - board)), [coverM, endM, boardM, boardM, boardM, boardM]);
    cover.position.set(0, 0, -(d - board) / 2);
    pivot.add(cover);
    group.add(spine, back, pages, pivot);
    this.heroScene.add(group);
    this.heroDirty = true;
    return {
      id,
      group,
      pivot,
      cover: 0,
      coverTarget: 0,
      tween: null,
      dispose: () => {
        tex.forEach((x) => x.dispose());
        geos.forEach((x) => x.dispose());
        mats.forEach((x) => x.dispose());
      },
    };
  }

  private removeHero(h: Hero) {
    this.heroScene.remove(h.group);
    h.dispose();
    this.heroDirty = true;
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number) {
    this.time += dt;
    let moving = false;
    const pull = new THREE.Vector3();
    for (const s of this.books.values()) {
      if (!s.mesh.visible && !s.follow) continue;
      pull.copy(s.tPos);
      if (this.hover === s.id && !this.drag) pull.z += 1.6;
      if (this.handled === s.id && !this.drag) pull.z += 0.8;
      const k = s.follow ? 900 : 190;
      const c = s.follow ? 2 * Math.sqrt(k) : 2 * Math.sqrt(k) * 0.78;
      // semi-implicit spring, fixed 1/240s sub-steps so a dropped frame
      // can never make it unstable
      const n = Math.max(1, Math.ceil(dt * 240));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        s.vel.x += ((pull.x - s.pos.x) * k - s.vel.x * c) * h;
        s.vel.y += ((pull.y - s.pos.y) * k - s.vel.y * c) * h;
        s.vel.z += ((pull.z - s.pos.z) * k - s.vel.z * c) * h;
        s.pos.addScaledVector(s.vel, h);
      }
      s.quat.slerp(s.tQuat, 1 - Math.exp(-(s.follow ? 22 : 11) * dt));
      const settled = s.pos.distanceToSquared(pull) < 1e-4 && s.vel.lengthSq() < 1e-3 && s.quat.angleTo(s.tQuat) < 1e-3;
      if (settled) {
        s.pos.copy(pull);
        s.vel.set(0, 0, 0);
        s.quat.copy(s.tQuat);
      } else moving = true;
      s.mesh.position.copy(s.pos);
      s.mesh.quaternion.copy(s.quat);
    }

    let heroActive = false;
    for (const h of [this.hero, ...this.outgoing]) {
      if (!h) continue;
      heroActive = true;
      this.stepHero(h, dt);
    }

    if (moving || this.dirty) {
      this.shelfR.render(this.scene, this.camera);
      this.dirty = false;
    }
    if (heroActive || this.heroDirty) {
      this.heroR.render(this.heroScene, this.camera);
      this.heroDirty = false;
    }
  }

  private stepHero(h: Hero, dt: number) {
    const g = h.group;
    if (h.tween) {
      const tw = h.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = easeInOut(tw.t);
      const to = tw.to();
      // cubic bezier: slide straight out of the shelf, then swing to the reader
      const p0 = tw.from.pos;
      const p1 = p0.clone().add(new THREE.Vector3(0, 0, tw.pullStart));
      const p3 = to.pos;
      const p2 = p3.clone().add(new THREE.Vector3(0, 0, tw.pullEnd));
      const u = 1 - e;
      g.position
        .copy(p0)
        .multiplyScalar(u * u * u)
        .addScaledVector(p1, 3 * u * u * e)
        .addScaledVector(p2, 3 * u * e * e)
        .addScaledVector(p3, e * e * e);
      // rotation lags the position a touch so the book clears its slot first
      const rStart = tw.pullStart > 0 ? 0.12 : 0;
      const rEnd = tw.pullEnd > 0 ? 0.88 : 1;
      const rt = easeInOut(THREE.MathUtils.clamp((tw.t - rStart) / (rEnd - rStart), 0, 1));
      g.quaternion.slerpQuaternions(tw.from.quat, to.quat, rt);
      if (tw.t >= 1) {
        h.tween = null;
        tw.done?.();
      }
    } else if (!h.leaving && (this.mode === "detail" || this.mode === "reader") && h === this.hero) {
      // idle: follow the slot (handles resize) with a gentle float
      const t = this.heroTarget(this.mode, h.id);
      const sway = this.mode === "detail" && !this.reduced ? 1 : 0;
      t.pos.y += Math.sin(this.time * 1.1) * 0.25 * sway;
      const q = new THREE.Quaternion().setFromAxisAngle(UP, Math.sin(this.time * 0.7) * 0.05 * sway).multiply(t.quat);
      g.position.lerp(t.pos, 1 - Math.exp(-10 * dt));
      g.quaternion.slerp(q, 1 - Math.exp(-10 * dt));
    }
    // cover hinge
    if (h.cover !== h.coverTarget) {
      const speed = this.reduced ? 12 : 4.2;
      h.cover += (h.coverTarget - h.cover) * (1 - Math.exp(-speed * dt));
      if (Math.abs(h.coverTarget - h.cover) < 0.002) h.cover = h.coverTarget;
      h.pivot.rotation.y = h.cover;
    }
  }

  // ------------------------------------------------------------------ teardown

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    if (this.handleTimer) clearTimeout(this.handleTimer);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.bookMat?.map?.dispose();
    this.shelfR?.dispose();
    this.heroR?.dispose();
  }
}

// ---------------------------------------------------------------- book geometry

/** A box whose six faces map into the shared atlas (spine on +z, cover on +x). */
function bookGeometry(id: string, atlas: Atlas) {
  const b = BOOK_BY_ID[id];
  const R = atlas.regions[id];
  const { w: AW, h: AH } = atlas.size;
  const x = b.t / 2,
    y = b.h / 2,
    z = b.d / 2;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  type V = [number, number, number];
  const face = (bl: V, br: V, tr: V, tl: V, n: V, r: { x: number; y: number; w: number; h: number }) => {
    const i = pos.length / 3;
    const u0 = (r.x + 0.5) / AW,
      u1 = (r.x + r.w - 0.5) / AW;
    const v0 = (r.y + r.h - 0.5) / AH, // bottom of the art (flipY = false)
      v1 = (r.y + 0.5) / AH;
    pos.push(...bl, ...br, ...tr, ...tl);
    for (let k = 0; k < 4; k++) nor.push(...n);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const P = atlas.pages;
  face([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1], R.spine); // spine
  face([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0], R.cover); // front cover
  face([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0], R.back); // back
  face([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1], P); // fore-edge
  face([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0], P); // top
  face([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0], P); // bottom
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
