"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOKS, BOOK_BY_ID, SHELVES, ROMAN, formatYear, type Pose } from "@/lib/books";
import type { LibraryEngine, Mode } from "@/lib/engine";

const FONTS = { serif: '"Cormorant Garamond"', caps: '"Cinzel"', sans: '"Jost"' };
const FONT_FACES = [
  '500 20px "Cormorant Garamond"',
  '600 20px "Cormorant Garamond"',
  '700 20px "Cormorant Garamond"',
  'italic 500 20px "Cormorant Garamond"',
  'italic 600 20px "Cormorant Garamond"',
  '500 20px "Cinzel"',
  '600 20px "Cinzel"',
  '500 20px "Jost"',
  '600 20px "Jost"',
];

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

export default function Library() {
  const rootRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLCanvasElement>(null);
  const snapRef = useRef<HTMLCanvasElement>(null);
  const detailSlot = useRef<HTMLDivElement>(null);
  const readerSlot = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LibraryEngine | null>(null);
  const lastFocus = useRef<string | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [epoch, setEpoch] = useState(0); // bump to rebuild after GPU loss
  const [backend, setBackend] = useState("");
  const [header, setHeader] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [handle, setHandle] = useState<{ id: string; pose: Pose } | null>(null);
  const [mode, setMode] = useState<Mode>("shelf");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  // books that fit on the shelves at this screen size (null until known)
  const [shelved, setShelved] = useState<Set<string> | null>(null);

  // ------------------------------------------------------------ engine lifecycle
  useEffect(() => {
    let engine: LibraryEngine | null = null;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all(FONT_FACES.map((f) => document.fonts.load(f)));
        const { LibraryEngine } = await import("@/lib/engine");
        if (cancelled || !rootRef.current || !shelfRef.current || !heroRef.current || !snapRef.current) return;
        engine = new LibraryEngine(rootRef.current, shelfRef.current, heroRef.current, snapRef.current, FONTS, {
          onHandle: (id, pose) => setHandle(id && pose ? { id, pose } : null),
          onMode: (m, id) => {
            setMode(m);
            if (id) setActiveId(id);
          },
          onHeaderRect: setHeader,
          onBackend: setBackend,
          onShelved: (ids) => setShelved(ids),
          onLost: () => setEpoch((e) => e + 1),
          getSlot: (m) => (m === "reader" ? readerSlot.current : detailSlot.current)?.getBoundingClientRect() ?? null,
        });
        await engine.init();
        if (cancelled) {
          engine.dispose();
          return;
        }
        engineRef.current = engine;
        setStatus("ready");
      } catch (err) {
        console.error("[shelf] renderer unavailable, using fallback", err);
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [epoch]);

  useEffect(() => {
    import("@/lib/textures").then(({ drawWood }) => {
      const url = drawWood(512, 256, "wood").toDataURL("image/jpeg", 0.82);
      rootRef.current?.style.setProperty("--wood", `url(${url})`);
    });
  }, []);

  // return keyboard focus to the book that was opened
  useEffect(() => {
    if (mode === "shelf" && lastFocus.current) {
      document.getElementById(`book-${lastFocus.current}`)?.focus({ preventScroll: true });
      lastFocus.current = null;
    }
  }, [mode]);

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      if (e.key === "Escape") {
        if (searchOpen) setSearchOpen(false);
        else if (mode === "reader") eng.closeReader();
        else if (mode === "detail") eng.close();
      } else if (mode === "detail" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        eng.step(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, searchOpen]);

  const open = useCallback((id: string) => {
    lastFocus.current = id;
    setSearchOpen(false);
    engineRef.current?.open(id);
  }, []);

  const book = activeId ? BOOK_BY_ID[activeId] : null;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = shelved ? BOOKS.filter((b) => shelved.has(b.id)) : BOOKS;
    if (!q) return pool.slice(0, 8);
    return pool.filter((b) => (b.title + " " + b.author).toLowerCase().includes(q)).slice(0, 12);
  }, [query, shelved]);

  // Transparent overlay for the logo and search button. The wood underneath
  // is the bookcase's own 3D crown board, which the engine keeps pinned to the
  // top of the screen, so it always matches the shelves.
  const headerStyle = header
    ? ({
        left: 0,
        top: 0,
        width: header.w,
        height: header.h,
        "--hw": `${Math.min(header.w, 680)}px`,
        "--vh": `${header.h}px`,
      } as React.CSSProperties)
    : { display: "none" };

  return (
    <main className={`library mode-${mode}`} data-backend={backend}>
      <div className="stage" ref={rootRef}>
        <canvas ref={shelfRef} className="shelf-canvas" aria-hidden />
        <canvas ref={snapRef} className="shelf-snap" aria-hidden />
        <div className="veil" aria-hidden />
        <canvas ref={heroRef} className="hero-canvas" aria-hidden />

        {/* crown: logo, or the pose control while a book is in hand */}
        <header className={`crown ${handle && mode === "shelf" ? "is-handling" : ""}`} style={headerStyle}>
          <div className="crown-inner">
          <div className="crown-logo">
            <button className="brass" aria-label="Search the shelves" onClick={() => setSearchOpen(true)}>
              <SearchIcon />
            </button>
            <div className="wordmark">
              <h1>GK Book Club</h1>
            </div>
            <span className="brass-spacer" aria-hidden />
          </div>
          <div className="crown-pose" aria-hidden={!handle}>
            <div className="segmented" role="radiogroup" aria-label="How the book sits">
              {POSES.map((p) => (
                <button
                  key={p.pose}
                  role="radio"
                  aria-checked={handle?.pose === p.pose}
                  className={handle?.pose === p.pose ? "on" : ""}
                  tabIndex={handle ? 0 : -1}
                  onClick={() => handle && engineRef.current?.setPose(handle.id, p.pose)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="hint">{handle ? HINT[handle.pose] : ""}</p>
          </div>
          </div>
        </header>

        {/* detail */}
        <section className="detail" aria-hidden={mode !== "detail"} aria-label={book ? `${book.title} details` : undefined}>
          <button className="close-x" onClick={() => engineRef.current?.close()} tabIndex={mode === "detail" ? 0 : -1}>
            Close
          </button>
          <div className="detail-col">
            <div className="slot-row">
              <button className="arrow" aria-label="Previous book" tabIndex={mode === "detail" ? 0 : -1} onClick={() => engineRef.current?.step(-1)}>
                ‹
              </button>
              <div className="slot" ref={detailSlot} />
              <button className="arrow" aria-label="Next book" tabIndex={mode === "detail" ? 0 : -1} onClick={() => engineRef.current?.step(1)}>
                ›
              </button>
            </div>
            {book && (
              <div className="meta" key={book.id}>
                <p className="genre">{book.genre}</p>
                <h2>{book.title}</h2>
                <p className="author">{book.author}</p>
                <p className="facts">
                  {formatYear(book.year)} · {book.pages} pages · Collector&rsquo;s edition
                </p>
                <p className="blurb">{book.blurb}</p>
              </div>
            )}
          </div>
        </section>

        {/* reader */}
        <section className="reader" aria-hidden={mode !== "reader"}>
          <button className="close-x" onClick={() => engineRef.current?.close()} tabIndex={mode === "reader" ? 0 : -1}>
            Close
          </button>
          <div className="reader-slot" ref={readerSlot} />
          {book && mode === "reader" && <p className="sr-only">{`${book.title}, first page: ${book.blurb}`}</p>}
          <button className="pill ghost close-book" tabIndex={mode === "reader" ? 0 : -1} onClick={() => engineRef.current?.closeReader()}>
            Close the book
          </button>
        </section>

        {/* search */}
        {searchOpen && (
          <div className="search" role="dialog" aria-label="Search the shelves" onPointerDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}>
            <div className="search-card">
              <input autoFocus placeholder="Title or author…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search titles and authors" />
              <ul>
                {results.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => open(b.id)}>
                      <span className="swatch" style={{ background: b.base }} />
                      <span>
                        <em>{b.title}</em>
                        <small>{b.author}</small>
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && <li className="empty">Nothing on these shelves.</li>}
              </ul>
            </div>
          </div>
        )}

        {status === "loading" && <div className="loading">Dusting the shelves…</div>}
        {status === "failed" && <Fallback onOpen={(id) => setActiveId(id)} />}
      </div>

      {/* The real, crawlable, keyboard-reachable list of books. The 3D shelf is an
          enhancement of this; focus moves the highlight on the shelf. */}
      <nav className="sr-only" aria-label="Books on the shelves">
        {SHELVES.map((name, s) => (
          <section key={name}>
            <h3>{`${ROMAN[s]} · ${name}`}</h3>
            <ul>
              {BOOKS.filter((b) => b.shelf === s && (!shelved || shelved.has(b.id))).map((b) => (
                <li key={b.id}>
                  <button
                    id={`book-${b.id}`}
                    onFocus={() => engineRef.current?.setHover(b.id)}
                    onBlur={() => engineRef.current?.setHover(null)}
                    onClick={() => open(b.id)}
                  >
                    {b.title} by {b.author}, {formatYear(b.year)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </main>
  );
}

function Fallback({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    
    <div className="fallback">
      <h1>GK Book Club</h1>
      {SHELVES.map((name, s) => (
        <section key={name}>
          <h2>{`${ROMAN[s]} · ${name}`}</h2>
          <div className="fallback-row">
            {BOOKS.filter((b) => b.shelf === s).map((b) => (
              <button key={b.id} style={{ background: b.base, color: b.ink }} onClick={() => onOpen(b.id)}>
                {b.title}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </svg>
  );
}
