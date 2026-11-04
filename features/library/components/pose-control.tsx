import type { CSSProperties } from "react";
import type { Pose } from "../../../domain/catalog";
import type { Mode, ScreenRect } from "../../../engine";

const POSES: { pose: Pose; label: string }[] = [
  { pose: "spine", label: "Spine out" },
  { pose: "face", label: "Face out" },
  { pose: "flat", label: "Laid flat" },
];

const HINT: Record<Pose, string> = {
  spine: "Drag to move · Tap to face it out",
  face: "Drag to move · Tap to lay it flat",
  flat: "Drag to move · Tap to stand it up",
};

interface Props {
  rect: ScreenRect | null; // the crown board's area on screen
  handle: { id: string; pose: Pose } | null;
  mode: Mode;
  onPose(id: string, pose: Pose): void;
}

// sits over the crown board and only shows while a book is in hand
export function PoseControl({ rect, handle, mode, onPose }: Props) {
  const style: CSSProperties = rect
    ? ({
        left: 0,
        top: 0,
        width: rect.w,
        height: rect.h,
        "--hw": `${Math.min(rect.w, 680)}px`,
        "--vh": `${rect.h}px`,
      } as CSSProperties)
    : { display: "none" };
  return (
    <header
      className={`crown ${handle && mode === "shelf" ? "is-handling" : ""}`}
      style={style}
    >
      <div className="crown-inner">
        <div className="crown-pose" aria-hidden={!handle}>
          <div
            className="segmented"
            role="radiogroup"
            aria-label="How the book sits"
          >
            {POSES.map((p) => (
              <button
                key={p.pose}
                role="radio"
                aria-checked={handle?.pose === p.pose}
                className={handle?.pose === p.pose ? "on" : ""}
                tabIndex={handle ? 0 : -1}
                onClick={() => handle && onPose(handle.id, p.pose)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="hint">{handle ? HINT[handle.pose] : ""}</p>
        </div>
      </div>
    </header>
  );
}
