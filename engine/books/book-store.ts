// owns every shelf book's mesh and state, built on demand one atlas page at a time

import * as THREE from "three/webgpu";
import { BOOKS, BOOK_BY_ID } from "../../domain/catalog";
import { buildAtlas, type Fonts } from "../../artwork";
import { CASE } from "../../domain/shelf";
import { canvasTexture } from "../render/renderer";
import { bookGeometry } from "./book-geometry";
import { stepBook } from "./motion";
import type { BookState } from "./book-state";

// a page holds one genre column, the genres a row shows side by side, so a phone only draws the first page
export const atlasPage = (id: string) =>
  Math.floor(BOOK_BY_ID[id].genreIndex / CASE.shelves);

export class BookStore {
  private books = new Map<string, BookState>();
  private meshes: THREE.Mesh[] = [];
  private mats: THREE.MeshLambertMaterial[] = [];
  private pagesBuilt = new Set<number>();
  private pull = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private fonts: Fonts,
  ) {}

  get(id: string) {
    return this.books.get(id);
  }

  values() {
    return this.books.values();
  }

  visibleMeshes() {
    return this.meshes.filter((m) => m.visible);
  }

  // builds the atlas pages these ids need, a page is drawn once
  ensure(ids: Iterable<string>) {
    const need = new Set<number>();
    for (const id of ids) if (!this.books.has(id)) need.add(atlasPage(id));
    for (const page of need)
      if (!this.pagesBuilt.has(page)) this.buildPage(page);
  }

  // steps every visible book, lift adds a forward nudge for hover and the book in hand
  step(dt: number, lift: (id: string) => number): boolean {
    let moving = false;
    for (const s of this.books.values()) {
      if (!s.mesh.visible && !s.follow) continue;
      this.pull.copy(s.tPos);
      this.pull.z += lift(s.id);
      if (stepBook(s, dt, this.pull)) moving = true;
    }
    return moving;
  }

  // geometry goes with the scene, the atlas textures are released here
  dispose() {
    this.mats.forEach((m) => m.map?.dispose());
  }

  private buildPage(page: number) {
    this.pagesBuilt.add(page);
    const list = BOOKS.filter((b) => atlasPage(b.id) === page);
    const atlas = buildAtlas(list, this.fonts, 4096);
    // diffuse only so a book looks the same on the shelf and in the hand from any angle
    const mat = new THREE.MeshLambertMaterial({
      map: canvasTexture(atlas.canvas, false),
    });
    this.mats.push(mat);
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
        choreo: null,
        ret: null,
      });
    }
  }
}
