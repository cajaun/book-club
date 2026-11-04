// per-book animation state, the mesh only ever copies pos and quat

import type * as THREE from "three/webgpu";
import type { Tween } from "../core/tween";

// a pose change done in three phases: pull clear of the shelf, turn, set down
export interface Choreo {
  from: THREE.Vector3;
  fromQ: THREE.Quaternion;
  t: number;
  dur: number;
  zc: number; // depth that clears the shelf front
  yc: number; // height that clears the board while turning, -infinity when not turning
}

export interface BookState {
  id: string;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  tPos: THREE.Vector3; // where the layout wants it
  tQuat: THREE.Quaternion;
  follow: boolean; // dragged, follows the pointer close
  offShelf: boolean; // does not fit on this screen's shelves
  inHand: boolean; // shown as the close-up instead
  choreo: Choreo | null;
  ret: Tween | null; // the last stretch of a return flight, continued on the shelf on the same curve
}

// places a book at once, no flight
export function place(s: BookState, pos: THREE.Vector3, quat: THREE.Quaternion) {
  s.pos.copy(pos);
  s.quat.copy(quat);
  s.vel.set(0, 0, 0);
  s.choreo = null;
  syncMesh(s);
}

export function syncMesh(s: BookState) {
  s.mesh.position.copy(s.pos);
  s.mesh.quaternion.copy(s.quat);
}

export function syncVisible(s: BookState) {
  s.mesh.visible = !s.offShelf && !s.inHand;
}
