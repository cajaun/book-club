// a book box whose six faces point into the shared atlas, spine on +z and cover on +x

import * as THREE from "three/webgpu";
import { BOOK_BY_ID } from "../../domain/catalog";
import type { Atlas, Rect } from "../../artwork";

type V3 = [number, number, number];

export function bookGeometry(id: string, atlas: Atlas) {
  const b = BOOK_BY_ID[id];
  const R = atlas.regions[id];
  const { w: AW, h: AH } = atlas.size;
  const x = b.t / 2;
  const y = b.h / 2;
  const z = b.d / 2;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const face = (bl: V3, br: V3, tr: V3, tl: V3, n: V3, r: Rect) => {
    const i = pos.length / 3;
    // half-texel inset keeps neighbouring atlas art out of the edges
    const u0 = (r.x + 0.5) / AW;
    const u1 = (r.x + r.w - 0.5) / AW;
    const v0 = (r.y + r.h - 0.5) / AH; // bottom of the art since the atlas is not flipped
    const v1 = (r.y + 0.5) / AH;
    pos.push(...bl, ...br, ...tr, ...tl);
    for (let k = 0; k < 4; k++) nor.push(...n);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const P = atlas.pages;
  face([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1], R.spine);
  face([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0], R.cover);
  face([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0], R.back);
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
