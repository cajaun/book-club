// The shelf engine. Owns two GPU canvases:
//   - `shelf`: the bookcase. Rendered on demand (only while something moves).
//   - `hero`:  a transparent canvas above the DOM blur layer that holds the one
//              book being looked at. Same camera, so the hand-off from shelf
//              to hero is pixel-identical and the flight starts from the slot.
// Renderer: three.js WebGPURenderer — WebGPU where available, automatic
// WebGL2 fallback everywhere else (append ?webgl to force the fallback).

import * as THREE from "three/webgpu";
import { BOOKS, BOOK_BY_ID, ROMAN, SHELVES, initialRows, type Entry, type Pose } from "./books";
import {
  CASE,
  baySegs,
  caseBounds,
  fitFrame,
  frame,
  idsOf,
  interiorTop,
  layoutAll,
  layoutRow,
  poseQuat,
  setFrame,
  surfaceY,
  type Target,
} from "./layout";
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
  /** Which books are on the shelves at this screen size. */
  onShelved(ids: Set<string>): void;
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
  offShelf: boolean; // doesn't fit on this screen's shelves
  inHand: boolean; // shown as the close-up instead
  // choreographed move (pose change / drop): pull clear of the shelf, turn, set down
  tw: { from: THREE.Vector3; fromQ: THREE.Quaternion; t: number; dur: number; zc: number; yc: number } | null;
}

interface HeroArt {
  cover: HTMLCanvasElement;
  spine: HTMLCanvasElement;
  back: HTMLCanvasElement;
  pages: HTMLCanvasElement;
  title: HTMLCanvasElement;
  end: HTMLCanvasElement;
}

const ART_FAST = 14; // px/cm, same as the shelf atlas
const ART_SHARP = 40; // px/cm, close-up

interface Hero {
  id: string;
  sharp: boolean;
  lw: number; // 0 = lit like the shelf, 1 = lit relative to its cover
  maps: Record<"cover" | "spine" | "title" | "end", THREE.MeshLambertMaterial>;
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
  ease?: (t: number) => number;
  lw?: [number, number];
  done?: () => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// fast start, soft landing: the book reacts on the same frame as the tap
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3.2);
// pose-change phases: out [0, PH_OUT], turn [PH_OUT, PH_IN], in [PH_IN, 1]
const PH_OUT = 0.26;
const PH_IN = 0.72;
/** z at which a book's centre is far enough forward to turn freely in front of the shelf. */
function clearZ(id: string) {
  const b = BOOK_BY_ID[id];
  return 1.2 + Math.sqrt(b.h * b.h + b.d * b.d + b.t * b.t) / 2;
}

// One light rig, used by both the shelf and the hero scene, so a book looks
// identical on the shelf and in the reader's hands.
const LIGHT = {
  // (Lambert: a face receives (key·cosθ + hemi·~0.5 + fill) / π)
  on: { hemi: 1.7, key: 1.55, fill: 0.75, keyColor: 0xfff0dc },
  off: { hemi: 0.6, key: 0.5, fill: 0.25, keyColor: 0xa9bcdc },
  sky: 0xfff4e6,
  ground: 0x3a2a1e,
  keyPos: new THREE.Vector3(70, 170, 460),
  fillPos: new THREE.Vector3(-60, 80, 400),
};

export class LibraryEngine {
  private shelfR!: THREE.WebGPURenderer;
  private heroR!: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private heroScene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(20, 1, 10, 3000);

  private bookMats: THREE.MeshLambertMaterial[] = [];
  private books = new Map<string, BookState>();
  private meshes: THREE.Mesh[] = [];
  // five rows; each row's entries run left to right across all bays
  private shelves: Entry[][] = initialRows();
  private ray = new THREE.Raycaster();
  private key!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private fill!: THREE.DirectionalLight;
  private hHemi!: THREE.HemisphereLight;
  private hKey!: THREE.DirectionalLight;
  private hFill!: THREE.DirectionalLight;
  private art = new Map<string, HeroArt>();
  private snapTimer: ReturnType<typeof setTimeout> | null = null;
  private wasMoving = false;
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
    lx: number;
    ly: number;
    t: number;
    pointerId: number;
    type: string;
    active: boolean;
    panning: boolean;
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
    private snapCanvas: HTMLCanvasElement,
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

    {
      const r = this.root.getBoundingClientRect();
      setFrame(fitFrame(r.width / Math.max(1, r.height)));
    }
    this.buildFurniture();
    this.buildLights();
    this.buildHeroLights();
    this.relayout(true);
    await this.warmUp();

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

  /**
   * Compile the hero's GPU pipelines up front. Without this the first tap
   * pays for shader compilation (100–400 ms on WebGPU) before the book moves.
   */
  private async warmUp() {
    try {
      const h = this.makeHero(BOOKS[0].id);
      h.group.position.set(0, this.camera.position.y, this.camera.position.z - 300);
      const r = this.heroR as unknown as { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void> };
      if (r.compileAsync) await r.compileAsync(this.heroScene, this.camera);
      else this.heroR.render(this.heroScene, this.camera);
      this.removeHero(h);
      this.heroR.render(this.heroScene, this.camera);
    } catch {
      /* warm-up is best effort */
    }
  }

  private async makeRenderer(canvas: HTMLCanvasElement, forceWebGL: boolean) {
    const r = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL });
    await r.init();
    r.setClearColor(0x000000, 0);
    // Lights are balanced so a book facing you shows its own colours at about
    // 0.9x (deep, like the reference); Khronos Neutral tone mapping is ~identity
    // there and only rolls off the brightest cream. Both canvases share it, so
    // a book looks the same on the shelf and in the hand.
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
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

  private furniture = new THREE.Group();
  private furnMats: {
    wood: THREE.Material;
    side: THREE.Material;
    sideWorld: THREE.Material;
    dark: THREE.Material;
    wall: THREE.Material;
    floor: THREE.Material;
    plaques: THREE.Material[];
  } | null = null;

  /** Bays side by side on wide screens (edge to edge), stacked on tall ones. */
  /** (Re)build the case for the current frame. Materials are made once. */
  private plaques: THREE.Mesh[][] = [];
  private buildFurniture() {
    if (!this.furnMats) {
      const woodH = this.canvasTex(drawWood(1024, 512, "wood"));
      woodH.wrapS = woodH.wrapT = THREE.RepeatWrapping;
      const woodV = woodH.clone();
      woodV.center.set(0.5, 0.5);
      woodV.rotation = Math.PI / 2;
      woodV.needsUpdate = true;
      this.furnMats = {
        wood: new THREE.MeshStandardMaterial({ map: woodH, roughness: 0.8 }),
        side: new THREE.MeshStandardMaterial({ map: woodV, roughness: 0.8 }),
        sideWorld: new THREE.MeshStandardMaterial({ map: woodH, roughness: 0.8 }),
        dark: new THREE.MeshStandardMaterial({ map: woodH, roughness: 0.85, color: 0x8a7464 }),
        wall: new THREE.MeshStandardMaterial({ map: this.canvasTex(drawBackWall(1024, 2048)), roughness: 0.95 }),
        floor: new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 1 }),
        plaques: SHELVES.map(
          (name, i) =>
            new THREE.MeshStandardMaterial({
              map: this.canvasTex(drawPlaque(`${ROMAN[i]}  ·  ${name.toUpperCase()}`, this.fonts, 2)),
              roughness: 0.6,
              transparent: true,
            }),
        ),
      };
    }
    const M = this.furnMats;
    this.furniture.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.scene.remove(this.furniture);
    this.furniture = new THREE.Group();
    this.scene.add(this.furniture);

    const { board, depth, side, plinth, cornice } = CASE;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.furniture.add(m);
      return m;
    };
    const F = frame();
    const B = caseBounds();
    const caseW = B.right - B.left;
    const segs = baySegs();

    this.plaques = [];
    for (let r = 0; r < CASE.shelves; r++) this.plaques.push([]);
    segs.forEach((g) => {
      for (let r = 0; r < CASE.shelves; r++) {
        add(new THREE.BoxGeometry(F.bayW, board, depth + 1), M.wood, g.cx, surfaceY(r) - board / 2, -depth / 2 + 0.5);
        // brass plaque on the board's front edge; its genre is set by relayout()
        const p = new THREE.Mesh(new THREE.PlaneGeometry(30, 30 * (56 / 512)), M.plaques[r]);
        p.position.set(g.cx, surfaceY(r) - board / 2, 1.12);
        this.furniture.add(p);
        this.plaques[r].push(p);
      }
      add(new THREE.BoxGeometry(F.bayW, board, depth + 1), M.dark, g.cx, interiorTop + board / 2, -depth / 2 + 0.5);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(F.bayW, interiorTop), M.wall);
      wall.position.set(g.cx, interiorTop / 2, -depth);
      wall.receiveShadow = true;
      this.furniture.add(wall);
    });
    // side panels and dividers
    const sideH = B.crownBottom - B.bot;
    for (let k = 0; k <= F.bays; k++) {
      const x = B.left + side / 2 + k * (F.bayW + side);
      const pos = new THREE.Vector3(x, B.bot + sideH / 2, -depth / 2 + 1.5);
      add(worldWoodUV(new THREE.BoxGeometry(side, sideH, depth + 3), pos), M.sideWorld, pos.x, pos.y, pos.z);
    }
    // crown (the header board), cornice, moulding, plinth
    add(new THREE.BoxGeometry(caseW, F.crown, depth + 3), M.wood, 0, B.crownBottom + F.crown / 2, -depth / 2 + 1.5);
    add(new THREE.BoxGeometry(caseW + 5, cornice, depth + 6), M.dark, 0, B.top - cornice / 2, -depth / 2 + 2);
    add(new THREE.BoxGeometry(caseW - side * 2, 1.6, 1.6), M.dark, 0, B.crownBottom + 0.8, 1.2);
    add(new THREE.BoxGeometry(caseW + 2, plinth, depth + 4), M.dark, 0, B.bot + plinth / 2, -depth / 2 + 2);
    // Desktop: the case's side panels simply carry on to both screen edges
    // as plain wood (same material, same depth), as do crown, cornice and plinth.
    if (F.roomW && F.roomW > caseW + 1) {
      const over = 20; // run past the screen edge so no seam ever shows
      const wingW = (F.roomW - caseW) / 2 + over;
      for (const dir of [-1, 1]) {
        const cx = dir * (caseW / 2 + wingW / 2);
        const pos = new THREE.Vector3(cx, B.bot + sideH / 2, -depth / 2 + 1.5);
        add(worldWoodUV(new THREE.BoxGeometry(wingW, sideH, depth + 3), pos), M.sideWorld, pos.x, pos.y, pos.z);
        add(new THREE.BoxGeometry(wingW, F.crown, depth + 3), M.wood, cx, B.crownBottom + F.crown / 2, -depth / 2 + 1.5);
        add(new THREE.BoxGeometry(wingW, cornice, depth + 6), M.dark, cx, B.top - cornice / 2, -depth / 2 + 2);
        add(new THREE.BoxGeometry(wingW, plinth, depth + 4), M.dark, cx, B.bot + plinth / 2, -depth / 2 + 2);
      }
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(caseW + 600, 300), M.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, B.bot, 100);
    floor.receiveShadow = true;
    this.furniture.add(floor);

    if (this.key) this.aimKey();
    this.dirty = true;
  }

  private aimKey() {
    const B = this.bounds();
    const center = new THREE.Vector3((B.left + B.right) / 2, (B.top + B.bot) / 2, -CASE.depth / 2);
    // same direction as designed for a single bay (lamp high, front-right)
    const dir = LIGHT.keyPos.clone().sub(new THREE.Vector3(0, interiorTop / 2, -CASE.depth / 2));
    this.key.target.position.copy(center);
    this.key.position.copy(center).add(dir);
    const sc = this.key.shadow.camera as THREE.OrthographicCamera;
    const hw = (B.right - B.left) / 2 + 24;
    const hh = (B.top - B.bot) / 2 + 30;
    sc.left = -hw;
    sc.right = hw;
    sc.top = hh;
    sc.bottom = -hh;
    sc.updateProjectionMatrix();
    const size = Math.max(hw, hh) > 160 ? 4096 : 2048;
    if (this.key.shadow.mapSize.x !== size) {
      this.key.shadow.mapSize.set(size, size);
      this.key.shadow.map?.dispose();
      (this.key.shadow as unknown as { map: unknown }).map = null;
    }
    this.key.shadow.needsUpdate = true;
  }

  /**
   * Book meshes + atlas pages, built on demand: a phone only shows the first
   * genre of each row, so it never pays for the other pages' textures.
   */
  private pagesBuilt = new Set<number>();
  private ensureBooks(ids: Iterable<string>) {
    const perPage = CASE.shelves;
    const need = new Set<number>();
    for (const id of ids) if (!this.books.has(id)) need.add(Math.floor(BOOK_BY_ID[id].shelf / perPage));
    for (const page of need) {
      if (this.pagesBuilt.has(page)) continue;
      this.pagesBuilt.add(page);
      const list = BOOKS.filter((b) => Math.floor(b.shelf / perPage) === page);
      const atlas = buildAtlas(list, this.fonts, 4096);
      // Diffuse-only (no view-dependent sheen): a book must look the same on
      // the shelf and in the hand, whatever angle it is seen from.
      const mat = new THREE.MeshLambertMaterial({ map: this.canvasTex(atlas.canvas, false) });
      this.bookMats.push(mat);
      for (const b of list) {
        const mesh = new THREE.Mesh(bookGeometry(b.id, atlas), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.id = b.id;
        mesh.visible = false;
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
          offShelf: true,
          inHand: false,
          tw: null,
        });
      }
    }
  }

  private syncVisible(s: BookState) {
    s.mesh.visible = !s.offShelf && !s.inHand;
  }

  private buildLights() {
    this.hemi = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.on.hemi);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(LIGHT.on.keyColor, LIGHT.on.key);
    key.position.copy(LIGHT.keyPos);
    key.target.position.set(0, interiorTop / 2, -CASE.depth / 2); // re-aimed in aimKey()
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
    this.aimKey();
    this.fill = new THREE.DirectionalLight(0xfff2e0, LIGHT.on.fill);
    this.fill.position.copy(LIGHT.fillPos);
    this.scene.add(this.fill);
  }

  private buildHeroLights() {
    // same rig as the shelf (directional lights only care about direction)
    this.hHemi = new THREE.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.on.hemi);
    this.hKey = new THREE.DirectionalLight(LIGHT.on.keyColor, LIGHT.on.key);
    this.hKey.position.copy(this.key.position).sub(this.key.target.position);
    this.hFill = new THREE.DirectionalLight(0xfff2e0, LIGHT.on.fill);
    this.hFill.position.copy(LIGHT.fillPos);
    this.heroScene.add(this.hHemi, this.hKey, this.hFill);
  }

  setLamp(on: boolean) {
    const L = on ? LIGHT.on : LIGHT.off;
    for (const [hemi, key, fill] of [
      [this.hemi, this.key, this.fill],
      [this.hHemi, this.hKey, this.hFill],
    ] as const) {
      hemi.intensity = L.hemi;
      key.intensity = L.key;
      key.color.set(L.keyColor);
      fill.intensity = L.fill;
    }
    this.dirty = true;
    this.heroDirty = true;
  }

  // ------------------------------------------------------------------ layout

  private relayout(snap = false) {
    const ph = this.drag && this.drag.target.stack === undefined ? { shelf: this.drag.target.shelf, index: this.drag.target.index, entry: this.drag.entry } : undefined;
    const { targets, spans, hidden } = layoutAll(this.shelves, ph);
    this.ensureBooks(targets.keys());
    targets.forEach((t: Target, id) => {
      const s = this.books.get(id)!;
      s.tPos.copy(t.pos);
      s.tQuat.copy(t.quat);
      // first appearance (or coming back on-shelf): place it, don't fly it in
      if (snap || s.offShelf) {
        s.pos.copy(t.pos);
        s.quat.copy(t.quat);
        s.vel.set(0, 0, 0);
        s.tw = null;
        s.mesh.position.copy(t.pos);
        s.mesh.quaternion.copy(t.quat);
      }
      s.offShelf = false;
      this.syncVisible(s);
    });
    for (const id of hidden) {
      const s = this.books.get(id);
      if (s && !s.follow) {
        s.offShelf = true;
        this.syncVisible(s);
      }
    }
    // each bay's plaque names the genre of the first book in it
    spans.forEach((row, r) => {
      const seen = new Set<number>();
      for (const sp of row) {
        if (sp.hidden || sp.bay < 0 || seen.has(sp.bay) || sp.index < 0) continue;
        const e = this.shelves[r][sp.index];
        const ids = e ? idsOf(e) : [];
        if (!ids.length) continue;
        seen.add(sp.bay);
        const p = this.plaques[r]?.[sp.bay];
        if (p) p.material = this.furnMats!.plaques[BOOK_BY_ID[ids[0]].shelf];
      }
      this.plaques[r]?.forEach((p, b) => (p.visible = seen.has(b)));
    });
    this.cb.onShelved(new Set(targets.keys()));
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
    this.relayout();
    this.choreograph(id, this.reduced ? 0.25 : 0.75);
    this.setHandled(id);
  }

  /**
   * Move a book along a path that stays in front of the shelf while it turns,
   * so it never cuts through the board or its neighbours.
   */
  private choreograph(id: string, dur: number) {
    const s = this.books.get(id);
    if (!s) return;
    const b = BOOK_BY_ID[id];
    const zc = clearZ(id);
    const loc = this.locate(id);
    // while turning, keep the lowest corner above the shelf surface
    const floor = loc ? surfaceY(loc.shelf) : s.tPos.y - b.h / 2;
    const yc = floor + Math.max(b.h, b.d) / 2 + 0.6;
    // already held clear (a drop)? skip the "pull out" phase
    const t0 = s.pos.z >= zc - 0.5 ? PH_OUT : 0;
    s.tw = { from: s.pos.clone(), fromQ: s.quat.clone(), t: t0, dur, zc, yc };
    s.vel.set(0, 0, 0);
    this.dirty = true;
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
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const changed = w !== this.size.w || h !== this.size.h;
    this.size = { w, h };
    // Resizing a canvas wipes it. Only do it when the size really changed, and
    // redraw in the same task so there is never a blank frame (mobile browser
    // toolbars sliding in and out fire resize events constantly).
    if (changed) {
      this.shelfR.setSize(w, h, false);
      this.heroR.setSize(w, h, false);
    }
    this.camera.aspect = this.size.w / this.size.h;
    const f = fitFrame(this.size.w / this.size.h);
    const cur = frame();
    if (changed && this.mode === "shelf" && !this.drag && (f.bays !== cur.bays || Math.abs(f.bayW - cur.bayW) > 0.5 || Math.abs(f.crown - cur.crown) > 0.5)) {
      setFrame(f);
      this.buildFurniture();
      this.relayout(); // books glide to their new places
      this.view = null;
    }
    if (!this.view) this.view = this.defaultView();
    this.applyView();
    if (changed) {
      this.shelfR.render(this.scene, this.camera);
      this.heroR.render(this.heroScene, this.camera);
      this.dirty = false;
    }
  }

  // The case is sized to the screen (see fitFrame), so the camera simply
  // frames all of it: five shelves, edge to edge, no scrolling or zooming.
  private view: { cx: number; cy: number; viewH: number } | null = null;

  private bounds() {
    return caseBounds();
  }

  /** Visible height (cm) at the case front that shows the whole case. */
  private framedH() {
    const B = this.bounds();
    const aspect = this.size.w / this.size.h;
    return Math.max(B.top - B.bot, (B.right - B.left) / aspect);
  }

  private defaultView() {
    const B = this.bounds();
    const viewH = this.framedH();
    return { cx: 0, cy: B.top - viewH / 2, viewH };
  }

  private clampView() {
    const v = this.view!;
    const B = this.bounds();
    v.viewH = this.framedH();
    v.cx = 0;
    const hh = v.viewH / 2;
    // anchored to the top; any spare height (very tall phones) falls below
    v.cy = B.top - hh;
  }

  private applyView() {
    this.clampView();
    const v = this.view!;
    const fov = this.camera.fov * (Math.PI / 180);
    // frame the plane of the case's front edge (z = 1.5) so its sides sit
    // exactly on the screen edges
    const front = 1.5;
    const dist = v.viewH / 2 / Math.tan(fov / 2);
    this.camera.position.set(v.cx, v.cy, front + dist);
    this.camera.lookAt(v.cx, v.cy, front);
    this.camera.near = 5;
    this.camera.far = dist + 400;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // tell the DOM where the crown board is so the header sits on it
    const B = this.bounds();
    const a = this.project(new THREE.Vector3(B.left, B.top - 2.4, 1.5));
    const b = this.project(new THREE.Vector3(B.right, B.crownBottom, 1.5));
    this.cb.onHeaderRect({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
    this.dirty = true;
  }

  /** Pan by a screen-space delta (content follows the finger). */
  private pan(dx: number, dy: number) {
    if (!this.view) return;
    const k = this.view.viewH / this.size.h;
    void dx; // width is locked edge to edge
    this.view.cy += dy * k;
    this.applyView();
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

  private ptrs = new Map<number, { x: number; y: number }>();
  private fling = { x: 0, y: 0 };
  private lastPtr: { x: number; y: number } | null = null;

  private bindPointer() {
    const el = this.root;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    el.addEventListener("pointerdown", (e) => {
      if (this.mode !== "shelf" || this.busy || e.button !== 0) return;
      // only the shelf itself; the header and panels handle their own input
      if (e.target !== this.shelfCanvas && e.target !== el) return;
      const p = local(e);
      this.ptrs.set(e.pointerId, p);
      el.setPointerCapture(e.pointerId);
      this.fling = { x: 0, y: 0 };
      if (this.ptrs.size === 2) {
        // a second finger cancels any tap / pick-up in progress (no zoom)
        if (this.down?.timer) clearTimeout(this.down.timer);
        if (this.down?.active) this.endDrag();
        this.down = null;
        return;
      }
      if (this.ptrs.size > 2) return;
      const id = this.pick(p.x, p.y);
      this.down = { id, x: p.x, y: p.y, lx: p.x, ly: p.y, t: performance.now(), pointerId: e.pointerId, type: e.pointerType, active: false, panning: false, timer: null };
      if (id) {
        this.prepareArt(id);
        // long-press picks a book up (on touch this is the only way, so a
        // swipe that starts on a book still scrolls)
        this.down.timer = setTimeout(() => {
          const d = this.down;
          if (d && !d.active && !d.panning && d.id) {
            navigator.vibrate?.(8);
            this.startDrag(d.lx, d.ly);
          }
        }, 380);
      }
    });
    el.addEventListener("pointermove", (e) => {
      const p = local(e);
      if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, p);
      if (this.ptrs.size >= 2) return;
      const d = this.down;
      if (d && d.pointerId === e.pointerId) {
        this.lastPtr = p;
        const moved = Math.hypot(p.x - d.x, p.y - d.y) > 6;
        if (!d.active && !d.panning && moved) {
          if (d.timer) clearTimeout(d.timer);
          // mouse on a book drags it; anything else pans the shelf
          if (d.id && d.type === "mouse") this.startDrag(p.x, p.y);
          else d.panning = true;
        }
        if (d.active) this.moveDrag(p.x, p.y);
        else if (d.panning) {
          const now = performance.now();
          const dt = Math.max(1, now - d.t) / 1000;
          this.fling = { x: (p.x - d.lx) / dt, y: (p.y - d.ly) / dt };
          this.pan(p.x - d.lx, p.y - d.ly);
          this.root.style.cursor = "grabbing";
        }
        d.lx = p.x;
        d.ly = p.y;
        d.t = performance.now();
        return;
      }
      if (this.mode !== "shelf" || this.busy) return;
      const id = e.pointerType === "mouse" ? this.pick(p.x, p.y) : null;
      this.setHover(id);
    });
    const up = (e: PointerEvent, cancelled = false) => {
      this.ptrs.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const d = this.down;
      if (!d || d.pointerId !== e.pointerId) return;
      if (d.timer) clearTimeout(d.timer);
      this.down = null;
      this.lastPtr = null;
      if (d.active) {
        this.endDrag();
        return;
      }
      if (d.panning) {
        this.root.style.cursor = "";
        if (performance.now() - d.t > 80) this.fling = { x: 0, y: 0 }; // finger stopped before lifting
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
    // wheel / trackpad: scroll the shelf vertically
    el.addEventListener(
      "wheel",
      (e) => {
        if (this.mode !== "shelf" || this.busy) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.size.h : 1;
        if (!e.ctrlKey) this.pan(0, -e.deltaY * unit); // ctrl+wheel (page zoom) is swallowed
      },
      { passive: false },
    );
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
    const p = this.pointOnPlane(cx, cy, clearZ(id));
    this.drag = {
      id,
      entry,
      offset: new THREE.Vector2(s.pos.x - p.x, s.pos.y - p.y),
      target: { shelf: loc.shelf, index },
      vx: 0,
      lastX: p.x,
    };
    s.follow = true;
    s.tw = null;
    this.setHover(null);
    this.root.style.cursor = "grabbing";
    this.setHandled(id);
    this.moveDrag(cx, cy);
  }

  private moveDrag(cx: number, cy: number) {
    const dr = this.drag;
    if (!dr) return;
    const s = this.books.get(dr.id)!;
    const p = this.pointOnPlane(cx, cy, clearZ(dr.id));
    const B = this.bounds();
    const bx = THREE.MathUtils.clamp(p.x + dr.offset.x, B.left + CASE.side + 2, B.right - CASE.side - 2);
    const by = THREE.MathUtils.clamp(p.y + dr.offset.y, -2, B.crownBottom);
    dr.vx = THREE.MathUtils.lerp(dr.vx, p.x - dr.lastX, 0.35);
    dr.lastX = p.x;

    // which shelf / where in it
    let shelf = 0;
    let best = Infinity;
    for (let i = 0; i < this.shelves.length; i++) {
      const dd = Math.abs(by - (surfaceY(i) + CASE.compH / 2));
      if (dd < best) {
        best = dd;
        shelf = i;
      }
    }
    // (a full row just pushes its last book off the end, like a real shelf)
    const tmp = new Map<string, Target>();
    const spans = layoutRow(this.shelves[shelf], shelf, tmp, new Set());
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
    s.tPos.set(bx, by, clearZ(dr.id));
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
    this.choreograph(dr.id, this.reduced ? 0.25 : 0.75);
    this.setHandled(dr.id);
  }

  // ------------------------------------------------------------------ hero (selected book)

  private heroTarget(mode: Mode, id: string) {
    const b = BOOK_BY_ID[id];
    const rect = this.cb.getSlot(mode);
    const rootR = this.root.getBoundingClientRect();
    const cx = rect ? rect.left - rootR.left + rect.width / 2 : this.size.w / 2;
    const cy = rect ? rect.top - rootR.top + rect.height / 2 : this.size.h * 0.35;
    // leave a little air so the turned book never touches the text below
    const rh = (rect ? rect.height : this.size.h * 0.4) * (mode === "detail" ? 0.9 : 1);
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
    if (!s || s.offShelf) return;
    this.setHover(null);
    if (!this.snapReady) this.takeSnap(); // only if tapped before the shelf ever settled
    const hero = this.makeHero(id);
    hero.group.position.copy(s.pos);
    hero.group.quaternion.copy(s.quat);
    s.inHand = true;
    this.syncVisible(s);
    this.snapshot(true);
    this.hero = hero;
    this.mode = "detail";
    this.cb.onMode("detail", id);
    this.dirty = true;
    const flat = this.poseOf(id) === "flat";
    hero.tween = {
      from: { pos: s.pos.clone(), quat: s.quat.clone() },
      to: () => this.heroTarget("detail", id),
      t: 0,
      dur: this.reduced ? 0.25 : 0.72,
      ease: easeOut,
      lw: [0, 1],
      pullStart: flat ? 16 : 22,
      pullEnd: 0,
      done: () => this.sharpen(hero),
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
    this.snapshot(false);
    this.cb.onMode("shelf", null);
    // Fly back to a point just in front of the slot, already square to it.
    // There the shelf's own copy of the book takes over and slides home in the
    // shelf scene, so the landing is continuous (its shadow grows in as it
    // goes) instead of the close-up vanishing and the shelf copy popping in.
    const out = this.poseOf(id) === "flat" ? 14 : 18;
    const front = () => s.tPos.clone().add(new THREE.Vector3(0, 0, out));
    hero.tween = {
      from: { pos: hero.group.position.clone(), quat: hero.group.quaternion.clone() },
      to: () => ({ pos: front(), quat: s.tQuat }),
      t: 0,
      dur: this.reduced ? 0.2 : 0.55,
      lw: [hero.lw, 0],
      pullStart: 0,
      pullEnd: 6,
      done: () => {
        const f = front();
        s.pos.copy(f);
        s.quat.copy(s.tQuat);
        s.vel.set(0, 0, 0);
        // run only the final "slide straight in" phase (~0.25 s)
        s.tw = { from: f.clone(), fromQ: s.tQuat.clone(), t: PH_IN, dur: this.reduced ? 0.4 : 0.9, zc: f.z, yc: -Infinity };
        s.mesh.position.copy(f);
        s.mesh.quaternion.copy(s.tQuat);
        s.inHand = false;
        this.syncVisible(s);
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
    const onShelf = order.filter((id) => id === this.hero!.id || (this.books.get(id) && !this.books.get(id)!.offShelf));
    const i = onShelf.indexOf(this.hero.id);
    const nextId = onShelf[(i + dir + onShelf.length) % onShelf.length];
    const old = this.hero;
    const oldS = this.books.get(old.id)!;
    oldS.inHand = false;
    this.syncVisible(oldS);
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
    hero.lw = 1;
    const target = this.heroTarget("detail", nextId);
    hero.group.position.copy(target.pos).sub(off);
    hero.group.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(UP, dir * 0.6).multiply(target.quat));
    const nextS = this.books.get(nextId)!;
    nextS.inHand = true;
    this.syncVisible(nextS);
    hero.tween = {
      from: { pos: hero.group.position.clone(), quat: hero.group.quaternion.clone() },
      to: () => this.heroTarget("detail", nextId),
      t: 0,
      dur: 0.5,
      ease: easeOut,
      pullStart: 0,
      pullEnd: 0,
      done: () => this.sharpen(hero),
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

  /**
   * Close-up artwork for one book. Drawn when the finger/mouse goes down on a
   * book (or on hover), so it is ready by the time the tap completes.
   */
  prepareArt(id: string, D = ART_FAST): HeroArt {
    const key = `${id}@${D}`;
    const hit = this.art.get(key);
    if (hit) return hit;
    const b = BOOK_BY_ID[id];
    const board = 0.28;
    const over = 0.3;
    const cover = makeCanvas(b.d * D, b.h * D);
    drawCover(cover.getContext("2d")!, 0, 0, cover.width, cover.height, b, this.fonts);
    const spine = makeCanvas(Math.max(8, b.t * D), b.h * D);
    drawSpine(spine.getContext("2d")!, 0, 0, spine.width, spine.height, b, this.fonts);
    const back = makeCanvas(64, 64);
    drawBack(back.getContext("2d")!, 0, 0, 64, 64, b);
    const pages = makeCanvas(256, 256);
    drawPages(pages.getContext("2d")!, 0, 0, 256, 256, b.id);
    const title = makeCanvas((b.d - over - board) * D, (b.h - over * 2) * D);
    drawTitlePage(title.getContext("2d")!, title.width, title.height, b, this.fonts);
    const ew = D >= ART_SHARP ? 384 : 128;
    const end = makeCanvas(ew, ew * 1.5);
    drawEndpaper(end.getContext("2d")!, ew, ew * 1.5, b);
    const art = { cover, spine, back, pages, title, end };
    this.art.set(key, art);
    if (this.art.size > 16) this.art.delete(this.art.keys().next().value!);
    return art;
  }

  private makeHero(id: string): Hero {
    const b = BOOK_BY_ID[id];
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
    const M = (o: THREE.MeshLambertMaterialParameters) => {
      const m = new THREE.MeshLambertMaterial(o);
      mats.push(m);
      return m;
    };
    const G = (g: THREE.BufferGeometry) => (geos.push(g), g);

    // start with shelf-density art (a few ms to draw/upload) so the book moves
    // on the very next frame; sharp art is swapped in once it has landed
    const A = this.prepareArt(id, ART_FAST);
    const [coverC, spineC, backC, pagesC, titleC, endC] = [A.cover, A.spine, A.back, A.pages, A.title, A.end];

    const boardM = M({ color: b.base });
    const coverM = M({ map: T(coverC) });
    const spineM = M({ map: T(spineC) });
    const backM = M({ map: T(backC) });
    const pagesM = M({ map: T(pagesC) });
    const titleM = M({ map: T(titleC) });
    const endM = M({ map: T(endC) });

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
      sharp: false,
      lw: 0,
      maps: { cover: coverM, spine: spineM, title: titleM, end: endM },
      dispose: () => {
        tex.forEach((x) => x.dispose());
        [coverM, spineM, titleM, endM].forEach((m) => m.map?.dispose());
        geos.forEach((x) => x.dispose());
        mats.forEach((x) => x.dispose());
      },
    };
  }

  /**
   * On the shelf the face you look at (spine or face-out cover) faces the
   * room's lamp. In the hand the cover faces you instead, turned and tilted, so
   * a fixed lamp would light it differently. Rotate the hero's light rig by the
   * same turn (blended by flight progress), so the cover in the hand receives
   * exactly the light a face-out cover receives on the shelf.
   */
  private aimHeroLights(h: Hero) {
    const coverN = new THREE.Vector3(1, 0, 0).applyQuaternion(h.group.quaternion);
    const full = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), coverN);
    const r = new THREE.Quaternion().slerp(full, h.lw);
    this.hKey.position.copy(this.key.position).sub(this.key.target.position).applyQuaternion(r);
    this.hFill.position.copy(LIGHT.fillPos).applyQuaternion(r);
    this.hHemi.position.set(0, 1, 0).applyQuaternion(r);
  }

  /** Swap in close-up resolution art, one texture per frame, once the book is still. */
  private sharpen(h: Hero) {
    if (h.sharp) return;
    h.sharp = true;
    const A = this.prepareArt(h.id, ART_SHARP);
    const jobs: [keyof Hero["maps"], HTMLCanvasElement][] = [
      ["cover", A.cover],
      ["spine", A.spine],
      ["title", A.title],
      ["end", A.end],
    ];
    const next = () => {
      const job = jobs.shift();
      if (!job || this.disposed || !h.group.parent) return;
      const m = h.maps[job[0]];
      const old = m.map;
      m.map = this.canvasTex(job[1]);
      old?.dispose();
      this.heroDirty = true;
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }

  /**
   * The blurred backdrop behind an open book. Instead of animating a
   * full-screen backdrop-filter (expensive on phones, and it re-blurs every
   * frame), grab the shelf once at 1/8 size; CSS blurs that tiny static image
   * once and the fade is a cheap opacity change.
   */
  private snapshot(show: boolean) {
    this.snapCanvas.classList.toggle("on", show);
  }

  /** Refresh the backdrop while the shelf is idle, never on the tap itself. */
  private scheduleSnap() {
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => {
      this.snapTimer = null;
      if (this.disposed || this.mode !== "shelf" || this.busy || this.drag) return;
      this.takeSnap();
    }, 350);
  }

  private snapReady = false;
  private takeSnap() {
      try {
        // render + copy in the same task, while the drawing buffer is valid
        this.shelfR.render(this.scene, this.camera);
        const c = this.snapCanvas;
        const w = Math.max(16, Math.round(this.size.w / 8));
        const h = Math.max(16, Math.round(this.size.h / 8));
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(this.shelfCanvas, 0, 0, w, h);
        this.snapReady = true;
      } catch {
        /* the veil still dims the shelf */
      }
  }

  private removeHero(h: Hero) {
    this.heroScene.remove(h.group);
    h.dispose();
    this.heroDirty = true;
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number) {
    this.time += dt;
    if (this.mode === "shelf") {
      if (!this.down && (Math.abs(this.fling.x) > 20 || Math.abs(this.fling.y) > 20)) {
        this.pan(this.fling.x * dt, this.fling.y * dt);
        const decay = Math.exp(-5 * dt);
        this.fling.x *= decay;
        this.fling.y *= decay;
      }
      // carrying a book near the top/bottom edge scrolls the shelf
      if (this.drag && this.lastPtr) {
        const edge = 80;
        const { y, x } = this.lastPtr;
        const vy = y < edge ? (edge - y) * 9 : y > this.size.h - edge ? -(y - (this.size.h - edge)) * 9 : 0;
        const vx = x < edge ? (edge - x) * 6 : x > this.size.w - edge ? -(x - (this.size.w - edge)) * 6 : 0;
        if (vx || vy) {
          this.pan(vx * dt, vy * dt);
          this.moveDrag(x, y);
        }
      }
    }
    let moving = false;
    const pull = new THREE.Vector3();
    for (const s of this.books.values()) {
      if (!s.mesh.visible && !s.follow) continue;
      pull.copy(s.tPos);
      if (this.hover === s.id && !this.drag) pull.z += 1.6;
      if (this.handled === s.id && !this.drag) pull.z += 0.8;
      if (s.tw) {
        const tw = s.tw;
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        const p0 = tw.from,
          p3 = pull;
        // waypoints: straight out of the slot -> clear of everything -> straight in
        const a = new THREE.Vector3(p0.x, Math.max(p0.y, tw.yc), tw.zc);
        const c = new THREE.Vector3(p3.x, Math.max(p3.y, tw.yc), tw.zc);
        const ph = (x: number, s0: number, s1: number) => THREE.MathUtils.smoothstep(x, s0, s1);
        let turn = 0;
        if (tw.t < PH_OUT) s.pos.lerpVectors(p0, a, ph(tw.t, 0, PH_OUT));
        else if (tw.t < PH_IN) {
          turn = ph(tw.t, PH_OUT, PH_IN);
          s.pos.lerpVectors(a, c, turn);
        } else {
          turn = 1;
          s.pos.lerpVectors(c, p3, ph(tw.t, PH_IN, 1));
        }
        s.quat.slerpQuaternions(tw.fromQ, s.tQuat, turn);
        if (tw.t >= 1) s.tw = null;
        moving = true;
        s.mesh.position.copy(s.pos);
        s.mesh.quaternion.copy(s.quat);
        continue;
      }
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
      this.wasMoving = true;
      if (this.mode === "shelf" && !this.busy) this.snapReady = false;
    } else if (this.wasMoving) {
      // shelf just came to rest: refresh the blurred backdrop in the background
      this.wasMoving = false;
      this.scheduleSnap();
    }
    if (heroActive || this.heroDirty) {
      this.heroR.render(this.heroScene, this.camera);
      this.heroDirty = false;
    }
  }

  private stepHero(h: Hero, dt: number) {
    const g = h.group;
    if (h === this.hero) this.aimHeroLights(h);
    if (h.tween) {
      const tw = h.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = (tw.ease ?? easeInOut)(tw.t);
      if (tw.lw) h.lw = THREE.MathUtils.lerp(tw.lw[0], tw.lw[1], e);
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
      const rStart = tw.pullStart > 0 ? 0.06 : 0;
      const rEnd = tw.pullEnd > 0 ? 0.88 : 1;
      const rt = (tw.ease ?? easeInOut)(THREE.MathUtils.clamp((tw.t - rStart) / (rEnd - rStart), 0, 1));
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
    if (this.snapTimer) clearTimeout(this.snapTimer);
    if (this.handleTimer) clearTimeout(this.handleTimer);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.bookMats.forEach((m) => m.map?.dispose());
    this.shelfR?.dispose();
    this.heroR?.dispose();
  }
}

/**
 * Map wood by real-world size instead of stretching the texture over each
 * box, so a 5 cm side panel and a 1 m wall show the same grain, and it runs
 * continuously from one into the other. Grain runs vertically.
 */
function worldWoodUV(g: THREE.BufferGeometry, at: THREE.Vector3, along = 140, across = 70) {
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + at.x,
      y = p.getY(i) + at.y,
      z = p.getZ(i) + at.z;
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i));
    // texture u runs along the grain (vertical), v across it
    if (ay > 0.5) uv.setXY(i, z / along, x / across); // top / bottom
    else if (ax > 0.5) uv.setXY(i, y / along, z / across); // left / right faces
    else uv.setXY(i, y / along, x / across); // front / back
  }
  uv.needsUpdate = true;
  return g;
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
