// the one camera both canvases share, plus scrolling and screen to world maths

import * as THREE from "three/webgpu";
import { FOV, FRONT_Z, caseBounds, frame } from "../../domain/shelf";
import type { ScreenRect } from "../types";

interface View {
  cy: number; // world y at the centre of the screen
  viewH: number; // world height the screen shows at the front of the case
}

export class ShelfCamera {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 10, 3000);
  size = { w: 1, h: 1 };
  private view: View | null = null;
  private ray = new THREE.Raycaster();
  private header = { w: 0, h: 0 };

  constructor(
    private onHeader: (r: ScreenRect) => void,
    private onChange: () => void,
  ) {}

  // returns true when the size changed
  setSize(w: number, h: number) {
    const changed = w !== this.size.w || h !== this.size.h;
    this.size = { w, h };
    this.camera.aspect = w / h;
    return changed;
  }

  // the next apply starts again from the top of the case
  resetView() {
    this.view = null;
  }

  // the width is locked edge to edge so only vertical pans move the view
  pan(dy: number) {
    if (!this.view) return;
    this.view.cy += dy * (this.view.viewH / this.size.h);
    this.apply();
  }

  apply() {
    const B = caseBounds();
    const viewH = this.framedHeight();
    const hh = viewH / 2;
    const cy = this.view?.cy ?? B.top - hh;
    // scroll between the top of the crown and the bottom of the plinth
    this.view = {
      viewH,
      cy:
        2 * hh >= B.top - B.bot
          ? B.top - hh
          : THREE.MathUtils.clamp(cy, B.bot + hh, B.top - hh),
    };
    // frame the case's front plane so its sides sit on the screen edges
    const dist = hh / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(0, this.view.cy, FRONT_Z + dist);
    this.camera.lookAt(0, this.view.cy, FRONT_Z);
    this.camera.near = 5;
    this.camera.far = dist + 400;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // the pose control sits over the crown board, report it only when its size changes
    const h = Math.round((B.top - B.crownBottom) * (this.size.h / viewH));
    if (h !== this.header.h || this.size.w !== this.header.w) {
      this.header = { w: this.size.w, h };
      this.onHeader({ x: 0, y: 0, w: this.size.w, h });
    }
    this.onChange();
  }

  project(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.size.w,
      y: ((1 - p.y) / 2) * this.size.h,
    };
  }

  rayAt(x: number, y: number) {
    const ndc = new THREE.Vector2(
      (x / this.size.w) * 2 - 1,
      -(y / this.size.h) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.ray;
  }

  pointOnPlane(x: number, y: number, z: number) {
    const p = new THREE.Vector3();
    this.rayAt(x, y).intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -z),
      p,
    );
    return p;
  }

  // id of the book under a screen point
  pick(x: number, y: number, meshes: THREE.Object3D[]): string | null {
    this.rayAt(x, y);
    const hit = this.ray.intersectObjects(meshes, false)[0];
    return hit ? (hit.object.userData.id as string) : null;
  }

  // world width the screen shows at depth p
  viewWidthAt(p: THREE.Vector3) {
    const dist = this.camera.position.z - p.z;
    return (
      2 *
      dist *
      Math.tan((this.camera.fov * Math.PI) / 360) *
      this.camera.aspect
    );
  }

  // the visible width (case on phones, room on desktop) at this aspect
  private framedHeight() {
    const B = caseBounds();
    return (frame().roomW ?? B.right - B.left) / (this.size.w / this.size.h);
  }
}
