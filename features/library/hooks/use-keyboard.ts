"use client";

import { useEffect } from "react";
import type { LibraryEngine, Mode } from "../../../engine";

interface KeyboardOptions {
  engine: () => LibraryEngine | null;
  mode: Mode;
  searchOpen: boolean;
  closeSearch(): void;
}

// escape backs out one level, the arrow keys step through books in the detail view
export function useKeyboard({
  engine,
  mode,
  searchOpen,
  closeSearch,
}: KeyboardOptions) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engine();
      if (!eng) return;
      if (e.key === "Escape") {
        if (searchOpen) closeSearch();
        else if (mode === "reader") eng.closeReader();
        else if (mode === "detail") eng.close();
      } else if (
        mode === "detail" &&
        (e.key === "ArrowRight" || e.key === "ArrowLeft")
      ) {
        eng.step(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, mode, searchOpen, closeSearch]);
}
