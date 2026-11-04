"use client";

import { useMemo, useState } from "react";
import { BOOKS } from "../../../domain/catalog";

interface Props {
  shelved: Set<string> | null; // only books on the shelves can be found
  onOpen(id: string): void;
  onDismiss(): void;
}

// title and author search, mounted only while open and without a button for now
export function SearchDialog({ shelved, onOpen, onDismiss }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = shelved ? BOOKS.filter((b) => shelved.has(b.id)) : BOOKS;
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((b) => (b.title + " " + b.author).toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, shelved]);
  return (
    <div
      className="search"
      role="dialog"
      aria-label="Search the shelves"
      onPointerDown={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div className="search-card">
        <input
          autoFocus
          placeholder="Title or author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search titles and authors"
        />
        <ul>
          {results.map((b) => (
            <li key={b.id}>
              <button onClick={() => onOpen(b.id)}>
                <span className="swatch" style={{ background: b.base }} />
                <span>
                  <em>{b.title}</em>
                  <small>{b.author}</small>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="empty">Nothing on these shelves.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
