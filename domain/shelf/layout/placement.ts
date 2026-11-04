// world transform of every book in a resolved entry

import { Euler, Quaternion, Vector3 } from "three/webgpu";
import { BOOK_BY_ID, rng, type Entry, type Pose } from "../../catalog";

export interface Target {
  pos: Vector3;
  quat: Quaternion;
}

// books are modelled spine towards +z, cover towards +x
const Q_SPINE = new Quaternion();
// face out turns the cover to the room and leans it back a touch
const Q_FACE = new Quaternion().setFromEuler(
  new Euler(0, -Math.PI / 2, 0.06, "YXZ"),
);
const Q_FLAT = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));

export function poseQuat(pose: Pose) {
  return (
    pose === "spine" ? Q_SPINE : pose === "face" ? Q_FACE : Q_FLAT
  ).clone();
}

// writes a target for each book in e, x is the entry's world left edge
export function placeEntry(
  e: Entry,
  x: number,
  w: number,
  y0: number,
  out: Map<string, Target>,
) {
  if (e.kind === "space") return;
  if (e.kind === "book") {
    const b = BOOK_BY_ID[e.id];
    const r = rng(b.id + "jit");
    if (e.pose === "spine") {
      // spines sit at slightly different depths like a real shelf
      const push = r() * 0.9;
      out.set(b.id, {
        pos: new Vector3(x + w / 2, y0 + b.h / 2, -1.2 - push - b.d / 2),
        quat: Q_SPINE.clone(),
      });
    } else {
      out.set(b.id, {
        pos: new Vector3(
          x + w / 2,
          y0 + (b.h / 2) * Math.cos(0.06) + 0.05,
          -4.5 - b.t / 2,
        ),
        quat: Q_FACE.clone(),
      });
    }
    return;
  }
  // stacks build up from ids[0] with a little seeded jitter per book
  let y = y0;
  e.ids.forEach((id, k) => {
    const b = BOOK_BY_ID[id];
    const r = rng(b.id + "stack" + k);
    const jx = (r() - 0.5) * 1.6;
    const jr = (r() - 0.5) * 0.06;
    const quat = new Quaternion().setFromEuler(
      new Euler(0, jr, Math.PI / 2, "YXZ"),
    );
    out.set(b.id, {
      pos: new Vector3(x + w / 2 + jx, y + b.t / 2, -1.4 - b.d / 2 - r() * 0.6),
      quat,
    });
    y += b.t;
  });
}
