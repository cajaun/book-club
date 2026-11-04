// the bookcase itself: boards, plaques, side panels, crown, plinth and the wood room around it

import * as THREE from "three/webgpu";
import { GENRES, ROMAN } from "../../domain/catalog";
import { drawBackWall, drawPlaque, drawWood, type Fonts } from "../../artwork";
import {
  CASE,
  caseBounds,
  frame,
  interiorTop,
  shelfSpan,
  surfaceY,
} from "../../domain/shelf";
import { canvasTexture } from "./renderer";
import { worldWoodUV } from "./wood-uv";

interface Materials {
  wood: THREE.Material; // horizontal grain for shelf boards
  dark: THREE.Material;
  sideWorld: THREE.Material; // world-mapped wood for panels, crown and wings
  darkWorld: THREE.Material;
  wall: THREE.Material;
  floor: THREE.Material;
  plaques: THREE.Material[]; // one per genre
}

const PLAQUE_W = 30;
const PLAQUE_H = PLAQUE_W * (56 / 512); // matches the plaque texture's aspect

export class Furniture {
  private group = new THREE.Group();
  private mats: Materials | null = null;
  private plaques: THREE.Mesh[] = []; // one per row

  constructor(
    private scene: THREE.Scene,
    private fonts: Fonts,
  ) {}

  // rebuilds the geometry for the current frame, materials are made once
  build() {
    const M = this.materials();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const { board, depth, side, plinth, cornice } = CASE;
    const F = frame();
    const B = caseBounds();
    const caseW = B.right - B.left;
    const span = shelfSpan();
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      shadow = true,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const addWorld = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      shadow = false,
    ) =>
      add(worldWoodUV(geo, new THREE.Vector3(x, y, z)), mat, x, y, z, shadow);

    // shelf boards, each with a brass plaque on its front edge
    this.plaques = [];
    for (let r = 0; r < CASE.shelves; r++) {
      const y = surfaceY(r) - board / 2;
      add(
        new THREE.BoxGeometry(F.bayW, board, depth + 1),
        M.wood,
        span.cx,
        y,
        -depth / 2 + 0.5,
      );
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_H),
        M.plaques[r],
      );
      plaque.position.set(span.cx, y, 1.12);
      this.group.add(plaque);
      this.plaques.push(plaque);
    }
    add(
      new THREE.BoxGeometry(F.bayW, board, depth + 1),
      M.dark,
      span.cx,
      interiorTop + board / 2,
      -depth / 2 + 0.5,
    );
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(F.bayW, interiorTop),
      M.wall,
    );
    wall.position.set(span.cx, interiorTop / 2, -depth);
    wall.receiveShadow = true;
    this.group.add(wall);

    // side panels
    const sideH = B.crownBottom - B.bot;
    const sideY = B.bot + sideH / 2;
    for (const x of [B.left + side / 2, B.right - side / 2])
      addWorld(
        new THREE.BoxGeometry(side, sideH, depth + 3),
        M.sideWorld,
        x,
        sideY,
        -depth / 2 + 1.5,
        true,
      );

    // crown, cornice, moulding and plinth
    addWorld(
      new THREE.BoxGeometry(caseW, F.crown, depth + 3),
      M.sideWorld,
      0,
      B.crownBottom + F.crown / 2,
      -depth / 2 + 1.5,
    );
    addWorld(
      new THREE.BoxGeometry(caseW + 5, cornice, depth + 6),
      M.darkWorld,
      0,
      B.top - cornice / 2,
      -depth / 2 + 2,
    );
    add(
      new THREE.BoxGeometry(caseW - side * 2, 1.6, 1.6),
      M.dark,
      0,
      B.crownBottom + 0.8,
      1.2,
      false,
    );
    addWorld(
      new THREE.BoxGeometry(caseW + 2, plinth, depth + 4),
      M.darkWorld,
      0,
      B.bot + plinth / 2,
      -depth / 2 + 2,
    );

    // desktop carries the panels, crown, cornice and plinth on to both screen edges as plain wood
    if (F.roomW && F.roomW > caseW + 1) {
      const wingW = (F.roomW - caseW) / 2 + 20; // runs past the screen edge so no seam shows
      for (const dir of [-1, 1]) {
        const cx = dir * (caseW / 2 + wingW / 2);
        addWorld(
          new THREE.BoxGeometry(wingW, sideH, depth + 3),
          M.sideWorld,
          cx,
          sideY,
          -depth / 2 + 1.5,
          true,
        );
        addWorld(
          new THREE.BoxGeometry(wingW, F.crown, depth + 3),
          M.sideWorld,
          cx,
          B.crownBottom + F.crown / 2,
          -depth / 2 + 1.5,
        );
        addWorld(
          new THREE.BoxGeometry(wingW, cornice, depth + 6),
          M.darkWorld,
          cx,
          B.top - cornice / 2,
          -depth / 2 + 2,
        );
        addWorld(
          new THREE.BoxGeometry(wingW, plinth, depth + 4),
          M.darkWorld,
          cx,
          B.bot + plinth / 2,
          -depth / 2 + 2,
        );
      }
    }

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(caseW + 600, 300),
      M.floor,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, B.bot, 100);
    floor.receiveShadow = true;
    this.group.add(floor);
  }

  // a row's plaque names the genre of its first book, an empty row shows none
  showPlaque(row: number, genreIndex: number | null) {
    const p = this.plaques[row];
    if (!p) return;
    p.visible = genreIndex !== null;
    if (genreIndex !== null) p.material = this.materials().plaques[genreIndex];
  }

  private materials(): Materials {
    if (this.mats) return this.mats;
    const woodH = canvasTexture(drawWood(1024, 512, "wood"));
    woodH.wrapS = woodH.wrapT = THREE.RepeatWrapping;
    // one large image mapped by real size so panels, crown and wings share one continuous grain
    const woodBig = canvasTexture(drawWood(2048, 2048, "woodbig"));
    this.mats = {
      wood: new THREE.MeshStandardMaterial({ map: woodH, roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({
        map: woodH,
        roughness: 0.85,
        color: 0x8a7464,
      }),
      sideWorld: new THREE.MeshStandardMaterial({
        map: woodBig,
        roughness: 0.8,
      }),
      darkWorld: new THREE.MeshStandardMaterial({
        map: woodBig,
        roughness: 0.85,
        color: 0x8a7464,
      }),
      wall: new THREE.MeshStandardMaterial({
        map: canvasTexture(drawBackWall(1024, 2048)),
        roughness: 0.95,
      }),
      floor: new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 1 }),
      plaques: GENRES.map(
        (name, i) =>
          new THREE.MeshStandardMaterial({
            map: canvasTexture(
              drawPlaque(
                `${ROMAN[i]}  ·  ${name.toUpperCase()}`,
                this.fonts,
                2,
              ),
            ),
            roughness: 0.6,
            transparent: true,
          }),
      ),
    };
    return this.mats;
  }
}
