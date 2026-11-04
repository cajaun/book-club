// one flight curve shared by the close-up book and its shelf copy

import { MathUtils, Quaternion, Vector3 } from "three/webgpu";
import { BOOK_BY_ID } from "../../domain/catalog";
import { easeInOut } from "./easing";

export interface PoseLike {
  pos: Vector3;
  quat: Quaternion;
}

export interface Tween {
  from: PoseLike;
  to: () => PoseLike; // re-read every frame so a moving target is tracked
  t: number;
  dur: number;
  pullStart: number; // cm the book slides towards the reader before turning
  pullEnd: number; // cm it comes in straight at the end
  ease?: (t: number) => number;
  lw?: [number, number]; // hero light blend from and to
  until?: number; // stop and call done at this progress, used for hand-offs
  done?: () => void;
}

// position on a cubic bezier with straight pull-out and pull-in legs, rotation lagging a touch
export function tweenPose(tw: Tween, t: number) {
  const ease = tw.ease ?? easeInOut;
  const e = ease(t);
  const to = tw.to();
  const p0 = tw.from.pos;
  const p1 = p0.clone().add(new Vector3(0, 0, tw.pullStart));
  const p3 = to.pos;
  const p2 = p3.clone().add(new Vector3(0, 0, tw.pullEnd));
  const u = 1 - e;
  const pos = p0
    .clone()
    .multiplyScalar(u * u * u)
    .addScaledVector(p1, 3 * u * u * e)
    .addScaledVector(p2, 3 * u * e * e)
    .addScaledVector(p3, e * e * e);
  // the book clears its slot before it starts to turn
  const rStart = tw.pullStart > 0 ? 0.06 : 0;
  const rEnd = tw.pullEnd > 0 ? 0.88 : 1;
  const rt = ease(MathUtils.clamp((t - rStart) / (rEnd - rStart), 0, 1));
  const quat = new Quaternion().slerpQuaternions(tw.from.quat, to.quat, rt);
  return { pos, quat, e };
}

// z where a book's centre is far enough forward to turn in front of the shelf
export function clearZ(id: string) {
  const b = BOOK_BY_ID[id];
  return 1.2 + Math.sqrt(b.h * b.h + b.d * b.d + b.t * b.t) / 2;
}
