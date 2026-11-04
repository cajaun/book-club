// maps wood by real size so a thin side panel and a wide wall share one continuous grain

import type { BufferGeometry, Vector3 } from "three/webgpu";

// u runs along the vertical grain, v across it, at is the mesh position in the world
export function worldWoodUV(g: BufferGeometry, at: Vector3, along = 300, across = 480) {
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  // offsets keep the whole case inside one tile so the image never wraps on screen
  const U = (v: number) => (v + 60) / along;
  const V = (v: number) => (v + 240) / across;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + at.x;
    const y = p.getY(i) + at.y;
    const z = p.getZ(i) + at.z;
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, U(z), V(x)); // top and bottom faces
    else if (ax > 0.5) uv.setXY(i, U(y), V(z)); // left and right faces
    else uv.setXY(i, U(y), V(x)); // front and back faces
  }
  uv.needsUpdate = true;
  return g;
}
