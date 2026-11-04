// shared shapes for the catalogue and the shelf arrangement

import type { CoverStyle, SpineStyle } from "../../data/palette";

export type { CoverStyle, SpineStyle };

export type Pose = "spine" | "face" | "flat";
// a single book stands either spine out or face out, flat books live in stacks
export type StandingPose = Exclude<Pose, "flat">;

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  pages: number;
  blurb: string;
  genre: string;
  genreIndex: number;
  price: number;
  // physical size in cm
  h: number; // height
  t: number; // thickness, the spine width
  d: number; // depth, the cover width
  base: string; // board colour
  ink: string; // title colour
  accent: string; // ornament colour
  spine: SpineStyle;
  cover: CoverStyle;
}

// x is the left edge in cm from the shelf's inner left side
export type Entry =
  | { kind: "book"; id: string; pose: StandingPose; x?: number }
  | { kind: "stack"; ids: string[]; x?: number } // ids[0] is the bottom book
  | { kind: "space"; w: number }; // spacing that only exists in the starting arrangement

// an entry that holds books
export type ItemEntry = Exclude<Entry, { kind: "space" }>;
