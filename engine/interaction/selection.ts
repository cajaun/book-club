// hover and the book in hand, the one the pose control acts on

import type { Pose } from "../../domain/catalog";

export interface SelectionDeps {
  root: HTMLElement;
  onHandle(id: string | null, pose: Pose | null): void;
  poseOf(id: string): Pose;
  isHolding(): boolean; // a finger or drag is still on the book
  invalidate(): void;
}

const HANDLE_TIMEOUT = 5000;

export class Selection {
  hover: string | null = null;
  handled: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private d: SelectionDeps) {}

  setHover(id: string | null) {
    if (this.hover === id) return;
    this.hover = id;
    this.d.root.style.cursor = id ? "grab" : "";
    this.d.invalidate();
  }

  // the book in hand lets go after a quiet spell unless it is still held
  setHandled(id: string | null) {
    this.handled = id;
    if (this.timer) clearTimeout(this.timer);
    if (id)
      this.timer = setTimeout(
        () => this.setHandled(this.d.isHolding() ? id : null),
        HANDLE_TIMEOUT,
      );
    this.d.onHandle(id, id ? this.d.poseOf(id) : null);
  }

  // forward nudge in cm so hovered and handled books stand out from the row
  lift(id: string, dragging: boolean) {
    if (dragging) return 0;
    return (this.hover === id ? 1.6 : 0) + (this.handled === id ? 0.8 : 0);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
  }
}
