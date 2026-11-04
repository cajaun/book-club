import type { Pose } from "../domain/catalog";

// shelf is the bookcase, detail is a book held up close, reader is a book opened to its title page
export type Mode = "shelf" | "detail" | "reader";

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// how the engine talks to the react layer
export interface EngineCallbacks {
  onHandle(id: string | null, pose: Pose | null): void; // the book in hand changed
  onMode(mode: Mode, id: string | null): void;
  onHeaderRect(r: ScreenRect): void; // area over the crown board for the pose control
  onBackend(name: string): void;
  onShelved(ids: Set<string>): void; // books that fit on the shelves at this screen size
  onLost(): void; // the gpu device went away and the engine needs a rebuild
  getSlot(mode: Mode): DOMRect | null; // dom box the close-up book is fitted into
}
