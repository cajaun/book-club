// builds every book from its catalogue row, the single source of truth for scene and ui

import { GENRES } from "./genres";
import {
  COVER_CYCLE,
  FEATURED,
  PALETTE,
  SPINE_CYCLE,
} from "../../data/palette";
import { rng, slug } from "./random";
import { TITLES, type TitleRow } from "../../data/titles";
import type { Book } from "./types";

const round1 = (v: number) => Math.round(v * 10) / 10;

function makeBook(
  [title, author, year, pages, blurb]: TitleRow,
  genreIndex: number,
  i: number,
): Book {
  const id = slug(title);
  // the call order on r fixes each book's look, keep it stable
  const r = rng(id);
  const [base, ink, accent] = PALETTE[Math.floor(r() * PALETTE.length)];
  const h = round1(21 + r() * 9);
  const t = round1(Math.min(4.8, Math.max(1.5, 1.1 + pages / 340 + r() * 0.7)));
  const price = 18 + Math.round(r() * 24);
  const d = round1(h * (0.64 + r() * 0.06));
  const cover = COVER_CYCLE[Math.floor(r() * COVER_CYCLE.length)];
  const featured = FEATURED[id];
  const book: Book = {
    id,
    title,
    author,
    year,
    pages,
    blurb,
    genre: GENRES[genreIndex],
    genreIndex,
    price,
    h,
    t,
    d,
    base,
    ink,
    accent,
    spine: SPINE_CYCLE[(i * 3 + genreIndex) % SPINE_CYCLE.length],
    cover,
    ...featured,
  };
  // a featured height without a featured width keeps a classic proportion
  if (featured?.h && !featured?.d) book.d = round1(book.h * 0.68);
  if (id === "dracula") book.price = 38;
  return book;
}

export const BOOKS: Book[] = [];
export const BOOK_BY_ID: Record<string, Book> = {};

TITLES.forEach((rows, genreIndex) =>
  rows.forEach((row, i) => {
    const book = makeBook(row, genreIndex, i);
    if (BOOK_BY_ID[book.id]) throw new Error(`duplicate book id: ${book.id}`);
    BOOKS.push(book);
    BOOK_BY_ID[book.id] = book;
  }),
);
