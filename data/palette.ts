export type SpineStyle = "cloth" | "paper" | "label" | "ribbed" | "pattern";
export type CoverStyle = "frame" | "sunburst" | "stripes" | "dots" | "waves" | "emblem" | "arch" | "panel";

// hand-picked overrides of a generated book's look and size in cm
export interface FeaturedLook {
  base?: string;
  ink?: string;
  accent?: string;
  spine?: SpineStyle;
  cover?: CoverStyle;
  h?: number;
  t?: number;
  d?: number;
}

// board colours as base, ink and accent, sampled from the reference video with the odd cream paperback
export const PALETTE: [string, string, string][] = [
  ["#6a1a1c", "#e3c98a", "#cfae68"], // oxblood
  ["#7d2320", "#ecd9a8", "#d6b46a"], // crimson
  ["#22412f", "#e2cc8e", "#c6a65e"], // bottle green
  ["#2e4a32", "#ead8a4", "#c9a95d"], // forest
  ["#1d2840", "#e3cf98", "#c4a35e"], // navy
  ["#273352", "#e8d6a6", "#c9a862"], // ink blue
  ["#b5862c", "#2a1b10", "#6e1d16"], // mustard
  ["#1b4846", "#ebd9a2", "#cda85a"], // teal
  ["#181512", "#d6b46a", "#a33a2c"], // black
  ["#3d1d38", "#e3cc90", "#c29a56"], // plum
  ["#5b6532", "#efe0b2", "#c8a35a"], // olive
  ["#a9502e", "#f3e3c4", "#2e1a10"], // terracotta
  ["#8f9a72", "#1f271b", "#6b2a20"], // sage
  ["#2b2a28", "#e6d6aa", "#b8924b"], // charcoal
  ["#e2d9c0", "#2a2018", "#a8352b"], // cream
  ["#8a2f2a", "#f0e2c2", "#2b1810"], // brick
];

// hand-styled books that appear face out or in close-ups of the reference
export const FEATURED: Record<string, FeaturedLook> = {
  dracula: { base: "#241a35", ink: "#e2c477", accent: "#c8a252", cover: "frame", spine: "label", t: 4.2, h: 24, d: 16.5 },
  frankenstein: { base: "#2a2522", ink: "#f0e4cc", accent: "#d8442e", cover: "sunburst", spine: "cloth", h: 24 },
  "little-women": { base: "#b7363a", ink: "#3b1414", accent: "#f2e6dc", cover: "stripes", spine: "pattern", h: 22, d: 16 },
  meditations: { base: "#c9d8a6", ink: "#2c3b1f", accent: "#6f8f45", cover: "dots", spine: "pattern", h: 23 },
  "treasure-island": { base: "#dcc8e3", ink: "#2b2340", accent: "#ffffff", cover: "waves", spine: "paper", h: 24, d: 17, t: 3.4 },
  "leaves-of-grass": { base: "#1e5b52", ink: "#efe2b8", accent: "#cfa95a", cover: "emblem", spine: "cloth", h: 25 },
  "anna-karenina": { base: "#1d1a17", ink: "#d8b46a", accent: "#c79d55", cover: "arch", spine: "ribbed", h: 27 },
  "the-three-musketeers": { base: "#6b3f7a", ink: "#f2e7d6", accent: "#e9d9f0", cover: "stripes", spine: "pattern", h: 26 },
  middlemarch: { base: "#efe6cf", ink: "#2b211a", accent: "#c8362d", spine: "paper", h: 29 },
  "madame-bovary": { base: "#ece2c8", ink: "#2a2018", accent: "#2b2b2b", spine: "paper", h: 27 },
  gitanjali: { base: "#d8a531", ink: "#2b1d12", accent: "#8a2a1c" },
};

// styles cycle through these lists so neighbouring books differ
export const SPINE_CYCLE: SpineStyle[] = ["cloth", "label", "cloth", "ribbed", "paper", "cloth", "label", "pattern", "cloth", "ribbed"];
export const COVER_CYCLE: CoverStyle[] = ["frame", "emblem", "arch", "panel", "dots", "stripes", "waves", "sunburst", "emblem", "panel"];
