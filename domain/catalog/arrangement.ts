// every genre's starting arrangement, hand-written ones from data and the rest generated

import { HAND_LAYOUTS, type LayoutItem } from "../../data/genre-layouts";
import { BOOKS } from "./books";
import { GENRES } from "./genres";
import { rng, slug } from "./random";
import type { Entry } from "./types";

function toEntry(item: LayoutItem): Entry {
  if (typeof item === "string")
    return { kind: "book", id: slug(item), pose: "spine" };
  if ("face" in item)
    return { kind: "book", id: slug(item.face), pose: "face" };
  if ("stack" in item) return { kind: "stack", ids: item.stack.map(slug) };
  return { kind: "space", w: item.space };
}

export const GENRE_LAYOUTS: Entry[][] = HAND_LAYOUTS.map((row) =>
  row.map(toEntry),
);

// the remaining genres follow the same pattern, seeded per genre
for (let genre = GENRE_LAYOUTS.length; genre < GENRES.length; genre++) {
  const ids = BOOKS.filter((book) => book.genreIndex === genre).map(
    (book) => book.id,
  );
  const r = rng("arrange" + genre);
  const face = ids.shift()!;
  const stackAt = 6 + Math.floor(r() * 4);
  const stack = ids.splice(stackAt, 3);
  const row: Entry[] = [
    { kind: "book", id: face, pose: "face" },
    { kind: "space", w: 1 },
  ];
  ids.forEach((id, i) => {
    if (i === stackAt)
      row.push(
        { kind: "space", w: 6 },
        { kind: "stack", ids: stack },
        { kind: "space", w: 2 },
      );
    row.push({ kind: "book", id, pose: "spine" });
  });
  GENRE_LAYOUTS.push(row);
}
