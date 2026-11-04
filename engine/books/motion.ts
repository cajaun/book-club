// moves one book a frame towards its target

import * as THREE from "three/webgpu";
import { BOOK_BY_ID } from "../../domain/catalog";
import { clearZ, tweenPose } from "../core/tween";
import { syncMesh, type BookState } from "./book-state";

// choreo phases: out on [0, PH_OUT], turn on [PH_OUT, PH_IN], in on [PH_IN, 1]
const PH_OUT = 0.26;
const PH_IN = 0.72;

// starts a move that stays in front of the shelf so the book never cuts a board, floorY is where it lands
export function startChoreo(s: BookState, floorY: number | null, dur: number) {
  const b = BOOK_BY_ID[s.id];
  const zc = clearZ(s.id);
  // only a real turn gets lifted, a book carried without turning goes straight to its spot
  const turning = s.quat.angleTo(s.tQuat) > 0.7;
  const floor = floorY ?? s.tPos.y - b.h / 2;
  const yc = turning ? floor + Math.max(b.h, b.d) / 2 + 0.6 : -Infinity;
  // a dropped book is already held clear so it skips the pull-out phase
  const t0 = s.pos.z >= zc - 0.5 ? PH_OUT : 0;
  s.choreo = { from: s.pos.clone(), fromQ: s.quat.clone(), t: t0, dur, zc, yc };
  s.vel.set(0, 0, 0);
}

// returns true while the book is still moving
export function stepBook(
  s: BookState,
  dt: number,
  pull: THREE.Vector3,
): boolean {
  if (s.ret) stepReturn(s, dt);
  else if (s.choreo) stepChoreo(s, dt, pull);
  else if (!stepSpring(s, dt, pull)) {
    syncMesh(s);
    return false;
  }
  syncMesh(s);
  return true;
}

function stepReturn(s: BookState, dt: number) {
  const r = s.ret!;
  r.t = Math.min(1, r.t + dt / r.dur);
  const P = tweenPose(r, r.t);
  s.pos.copy(P.pos);
  s.quat.copy(P.quat);
  if (r.t >= 1) {
    s.ret = null;
    s.pos.copy(s.tPos);
    s.quat.copy(s.tQuat);
    s.vel.set(0, 0, 0);
  }
}

function stepChoreo(s: BookState, dt: number, target: THREE.Vector3) {
  const c = s.choreo!;
  c.t = Math.min(1, c.t + dt / c.dur);
  // waypoints: straight out of the slot, clear of everything, then straight in
  const a = new THREE.Vector3(c.from.x, Math.max(c.from.y, c.yc), c.zc);
  const b = new THREE.Vector3(target.x, Math.max(target.y, c.yc), c.zc);
  const ph = THREE.MathUtils.smoothstep;
  let turn = 0;
  if (c.t < PH_OUT) s.pos.lerpVectors(c.from, a, ph(c.t, 0, PH_OUT));
  else if (c.t < PH_IN) {
    turn = ph(c.t, PH_OUT, PH_IN);
    s.pos.lerpVectors(a, b, turn);
  } else {
    turn = 1;
    s.pos.lerpVectors(b, target, ph(c.t, PH_IN, 1));
  }
  s.quat.slerpQuaternions(c.fromQ, s.tQuat, turn);
  if (c.t >= 1) s.choreo = null;
}

// critically damped while dragged, a touch springy otherwise, returns false once settled
function stepSpring(s: BookState, dt: number, pull: THREE.Vector3): boolean {
  const k = s.follow ? 900 : 190;
  const c = s.follow ? 2 * Math.sqrt(k) : 2 * Math.sqrt(k) * 0.78;
  // fixed 1/240 s sub-steps keep the semi-implicit spring stable through a dropped frame
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.vel.x += ((pull.x - s.pos.x) * k - s.vel.x * c) * h;
    s.vel.y += ((pull.y - s.pos.y) * k - s.vel.y * c) * h;
    s.vel.z += ((pull.z - s.pos.z) * k - s.vel.z * c) * h;
    s.pos.addScaledVector(s.vel, h);
  }
  s.quat.slerp(s.tQuat, 1 - Math.exp(-(s.follow ? 22 : 11) * dt));
  const settled =
    s.pos.distanceToSquared(pull) < 1e-4 &&
    s.vel.lengthSq() < 1e-3 &&
    s.quat.angleTo(s.tQuat) < 1e-3;
  if (!settled) return true;
  s.pos.copy(pull);
  s.vel.set(0, 0, 0);
  s.quat.copy(s.tQuat);
  return false;
}
