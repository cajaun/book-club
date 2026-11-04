// where the close-up book floats, fitted into a dom slot

import * as THREE from "three/webgpu";
import { BOOK_BY_ID } from "../../domain/catalog";
import { UP, X_AXIS } from "../core/axes";
import type { ShelfCamera } from "../camera/shelf-camera";
import type { Mode } from "../types";

// slot and root are viewport rects, a missing slot falls back to a sensible screen area
export function heroTarget(
  cam: ShelfCamera,
  mode: Mode,
  id: string,
  slot: DOMRect | null,
  root: DOMRect,
) {
  const b = BOOK_BY_ID[id];
  const { w: W, h: H } = cam.size;
  const cx = slot ? slot.left - root.left + slot.width / 2 : W / 2;
  const cy = slot ? slot.top - root.top + slot.height / 2 : H * 0.35;
  // the detail view leaves a little air so the turned book never touches the text below
  const rh = (slot ? slot.height : H * 0.4) * (mode === "detail" ? 0.9 : 1);
  const rw = slot ? slot.width : W * 0.6;
  const tan = Math.tan((cam.camera.fov * Math.PI) / 360);
  // turned three quarters the book shows most of its cover and a sliver of spine
  const wEff = mode === "reader" ? b.d : b.d * 0.98 + b.t * 0.24;
  const dist = Math.max(
    (b.h * H) / (rh * 2 * tan),
    (wEff * H) / (rw * 2 * tan),
  );
  const dir = cam.rayAt(cx, cy).direction.clone();
  const eye = cam.camera.position;
  const pos = eye
    .clone()
    .addScaledVector(dir, dist / dir.dot(new THREE.Vector3(0, 0, -1)));
  const yaw = mode === "reader" ? -Math.PI / 2 : -Math.PI / 2 + 0.27;
  const pitch = mode === "reader" ? 0 : -0.04;
  // face the eye rather than the screen plane so a book above centre never shows its bottom edge
  const toCam = eye.clone().sub(pos);
  const quat = new THREE.Quaternion()
    .setFromAxisAngle(UP, Math.atan2(toCam.x, toCam.z))
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        X_AXIS,
        -Math.atan2(toCam.y, Math.hypot(toCam.x, toCam.z)),
      ),
    )
    .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, pitch))
    .multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
  return { pos, quat };
}
