"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOOK_BY_ID } from "../../../domain/catalog";
import { BookIndex } from "./book-index";
import { DetailPanel } from "./detail-panel";
import { Fallback } from "./fallback";
import { PoseControl } from "./pose-control";
import { ReaderPanel } from "./reader-panel";
import { SearchDialog } from "./search-dialog";
import { useKeyboard } from "../hooks/use-keyboard";
import { useLibraryEngine } from "../hooks/use-library-engine";
import { useWoodBackground } from "../hooks/use-wood-background";
import "../styles/stage.css";
import "../styles/crown.css";
import "../styles/panels.css";
import "../styles/search.css";
import "../styles/fallback.css";

// the page: two canvases from the engine with the dom panels layered over them
export default function Library() {
  const rootRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLCanvasElement>(null);
  const detailSlot = useRef<HTMLDivElement>(null);
  const readerSlot = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    engineRef,
    status,
    backend,
    header,
    handle,
    mode,
    activeId,
    setActiveId,
    shelved,
  } = useLibraryEngine({
    root: rootRef,
    shelf: shelfRef,
    hero: heroRef,
    detailSlot,
    readerSlot,
  });
  const engine = useCallback(() => engineRef.current, [engineRef]);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useWoodBackground(rootRef);
  useKeyboard({ engine, mode, searchOpen, closeSearch });

  // keyboard focus returns to the book that was opened
  useEffect(() => {
    if (mode === "shelf" && lastFocus.current) {
      document
        .getElementById(`book-${lastFocus.current}`)
        ?.focus({ preventScroll: true });
      lastFocus.current = null;
    }
  }, [mode]);

  const open = useCallback(
    (id: string) => {
      lastFocus.current = id;
      setSearchOpen(false);
      engineRef.current?.open(id);
    },
    [engineRef],
  );

  const book = activeId ? BOOK_BY_ID[activeId] : null;

  return (
    <main className={`library mode-${mode}`} data-backend={backend}>
      <div className="stage" ref={rootRef}>
        <canvas ref={shelfRef} className="shelf-canvas" aria-hidden />
        <div className="veil" aria-hidden />
        <canvas ref={heroRef} className="hero-canvas" aria-hidden />
        <PoseControl
          rect={header}
          handle={handle}
          mode={mode}
          onPose={(id, pose) => engine()?.setPose(id, pose)}
        />
        <DetailPanel
          book={book}
          open={mode === "detail"}
          slotRef={detailSlot}
          onClose={() => engine()?.close()}
          onStep={(dir) => engine()?.step(dir)}
        />
        <ReaderPanel
          book={book}
          open={mode === "reader"}
          slotRef={readerSlot}
          onClose={() => engine()?.close()}
          onCloseBook={() => engine()?.closeReader()}
        />
        {searchOpen && (
          <SearchDialog
            shelved={shelved}
            onOpen={open}
            onDismiss={closeSearch}
          />
        )}
        {status === "loading" && (
          <div className="loading">Dusting the shelves…</div>
        )}
        {status === "failed" && <Fallback onOpen={setActiveId} />}
      </div>
      <BookIndex
        shelved={shelved}
        onFocusBook={(id) => engine()?.setHover(id)}
        onOpen={open}
      />
    </main>
  );
}
