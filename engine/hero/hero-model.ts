// the detailed close-up book: hinged front board, page block, endpapers and title page

import * as THREE from "three/webgpu";
import { BOOK_BY_ID } from "../../domain/catalog";
import type { Tween } from "../core/tween";
import { canvasTexture } from "../render/renderer";
import { HERO_BOARD, type HeroArt } from "./hero-art";

export type SharpSlot = "cover" | "spine" | "title" | "end";

export interface Hero {
  id: string;
  group: THREE.Group;
  pivot: THREE.Object3D; // the front board's hinge
  maps: Record<SharpSlot, THREE.MeshLambertMaterial>; // materials whose art gets sharpened
  sharp: boolean;
  lw: number; // 0 lit like the shelf, 1 lit relative to its cover
  cover: number; // current cover angle
  coverTarget: number;
  tween: Tween | null;
  leaving?: boolean; // sliding out after a step to the next book
  dispose(): void;
}

export function createHero(id: string, art: HeroArt): Hero {
  const b = BOOK_BY_ID[id];
  const board = HERO_BOARD;
  const tex: THREE.Texture[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.MeshLambertMaterial[] = [];
  const T = (c: HTMLCanvasElement) => {
    const t = canvasTexture(c);
    tex.push(t);
    return t;
  };
  const M = (o: THREE.MeshLambertMaterialParameters) => {
    const m = new THREE.MeshLambertMaterial(o);
    mats.push(m);
    return m;
  };
  const G = (g: THREE.BufferGeometry) => (geos.push(g), g);

  const boardM = M({ color: b.base });
  const coverM = M({ map: T(art.cover) });
  const spineM = M({ map: T(art.spine) });
  const backM = M({ map: T(art.back) });
  const pagesM = M({ map: T(art.pages) });
  const titleM = M({ map: T(art.title) });
  const endM = M({ map: T(art.end) });

  const { t, h, d } = b;
  // box material order is +x, -x, +y, -y, +z, -z
  const spine = new THREE.Mesh(G(new THREE.BoxGeometry(t, h, board)), [
    boardM,
    boardM,
    boardM,
    boardM,
    spineM,
    boardM,
  ]);
  spine.position.set(0, 0, d / 2 - board / 2);
  const back = new THREE.Mesh(G(new THREE.BoxGeometry(board, h, d - board)), [
    endM,
    backM,
    boardM,
    boardM,
    boardM,
    boardM,
  ]);
  back.position.set(-t / 2 + board / 2, 0, -board / 2);
  const pages = new THREE.Mesh(
    G(new THREE.BoxGeometry(t - board * 2, h, d - board)),
    [titleM, pagesM, pagesM, pagesM, pagesM, pagesM],
  );
  pages.position.set(0, 0, -board / 2);
  const pivot = new THREE.Object3D();
  pivot.position.set(t / 2 - board / 2, 0, d / 2 - board);
  const cover = new THREE.Mesh(G(new THREE.BoxGeometry(board, h, d - board)), [
    coverM,
    endM,
    boardM,
    boardM,
    boardM,
    boardM,
  ]);
  cover.position.set(0, 0, -(d - board) / 2);
  pivot.add(cover);
  const group = new THREE.Group();
  group.add(spine, back, pages, pivot);

  const maps = { cover: coverM, spine: spineM, title: titleM, end: endM };
  return {
    id,
    group,
    pivot,
    maps,
    sharp: false,
    lw: 0,
    cover: 0,
    coverTarget: 0,
    tween: null,
    dispose: () => {
      tex.forEach((x) => x.dispose());
      // sharpened maps replaced the originals so release whatever is current
      Object.values(maps).forEach((m) => m.map?.dispose());
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
    },
  };
}

// swaps one material's art, the old texture is released
export function swapArt(hero: Hero, slot: SharpSlot, c: HTMLCanvasElement) {
  const m = hero.maps[slot];
  const old = m.map;
  m.map = canvasTexture(c);
  old?.dispose();
}
