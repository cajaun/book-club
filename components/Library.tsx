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
  const [lamp, setLamp] = useState(true);
  const [bag, setBag] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // ------------------------------------------------------------ engine lifecycle
  useEffect(() => {
    let engine: LibraryEngine | null = null;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all(FONT_FACES.map((f) => document.fonts.load(f)));
        const { LibraryEngine } = await import("@/lib/engine");
        if (cancelled || !rootRef.current || !shelfRef.current || !heroRef.current) return;
        engine = new LibraryEngine(rootRef.current, shelfRef.current, heroRef.current, FONTS, {
          onHandle: (id, pose) => setHandle(id && pose ? { id, pose } : null),
          onMode: (m, id) => {
            setMode(m);
            if (id) setActiveId(id);
          },
          onHeaderRect: setHeader,
          onBackend: setBackend,
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
  const inBag = book ? bag.includes(book.id) : false;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BOOKS.slice(0, 8);
    return BOOKS.filter((b) => (b.title + " " + b.author).toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  const headerStyle = header
    ? ({
        left: header.x,
        top: header.y,
        width: header.w,
        height: header.h,
        "--hw": `${Math.min(header.w, 560)}px`,
        // when the case is wider than the screen, keep the controls on-screen
        "--inset": `${Math.max(0, -header.x, header.x + header.w - (rootRef.current?.clientWidth ?? header.w))}px`,
      } as React.CSSProperties)
    : { display: "none" };

  return (
    <main className={`library mode-${mode}`} data-backend={backend}>
      <div className="stage" ref={rootRef}>
        <canvas ref={shelfRef} className="shelf-canvas" aria-hidden />
        <div className="veil" aria-hidden />
        <canvas ref={heroRef} className="hero-canvas" aria-hidden />

        {/* crown: logo, or the pose control while a book is in hand */}
        <header className={`crown ${handle && mode === "shelf" ? "is-handling" : ""}`} style={headerStyle}>
          <div className="crown-logo">
            <button className="brass" aria-label="Search the shelves" onClick={() => setSearchOpen(true)}>
              <SearchIcon />
            </button>
            <button className={`brass ${lamp ? "" : "is-off"}`} aria-label={lamp ? "Dim the lamp" : "Light the lamp"} aria-pressed={lamp} onClick={() => {
              setLamp(!lamp);
              engineRef.current?.setLamp(!lamp);
            }}>
              <LampIcon />
            </button>
            <div className="wordmark">
              <h1>Marginalia</h1>
              <p>Booksellers · Est. 1921</p>
            </div>
            <button className="brass bag" aria-label={`Bag, ${bag.length} items`}>
              <BagIcon />
              {bag.length > 0 && <span className="bag-count">{bag.length}</span>}
            </button>
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
                <div className="actions">
                  <button
                    className="pill solid"
                    tabIndex={mode === "detail" ? 0 : -1}
                    onClick={() => !inBag && setBag((b) => [...b, book.id])}
                  >
                    {inBag ? "In your bag ✓" : `Add to bag — $${book.price.toFixed(2)}`}
                  </button>
                  <button className="pill ghost" tabIndex={mode === "detail" ? 0 : -1} onClick={() => engineRef.current?.openReader()}>
                    Read a page
                  </button>
                </div>
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
              {BOOKS.filter((b) => b.shelf === s).map((b) => (
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
      <h1>Marginalia</h1>
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
function LampIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M5 14h14l-3-7H8z" />
      <path d="M9.5 17.5a2.5 2.5 0 005 0" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M5 9h14l-1 11H6z" />
      <path d="M9 9V7a3 3 0 016 0v2" strokeLinecap="round" />
    </svg>
  );
}
