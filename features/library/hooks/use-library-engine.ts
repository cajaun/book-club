"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Pose } from "../../../domain/catalog";
import type { LibraryEngine, Mode, ScreenRect } from "../../../engine";
import { FONTS, FONT_FACES } from "../config/fonts";

export interface EngineRefs {
  root: RefObject<HTMLDivElement>;
  shelf: RefObject<HTMLCanvasElement>;
  hero: RefObject<HTMLCanvasElement>;
  detailSlot: RefObject<HTMLDivElement>;
  readerSlot: RefObject<HTMLDivElement>;
}

export type Status = "loading" | "ready" | "failed";

// starts the 3d engine after first paint and mirrors its state into react
export function useLibraryEngine(refs: EngineRefs) {
  const engineRef = useRef<LibraryEngine | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [epoch, setEpoch] = useState(0); // bumping it rebuilds the engine after gpu loss
  const [backend, setBackend] = useState("");
  const [header, setHeader] = useState<ScreenRect | null>(null);
  const [handle, setHandle] = useState<{ id: string; pose: Pose } | null>(null);
  const [mode, setMode] = useState<Mode>("shelf");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shelved, setShelved] = useState<Set<string> | null>(null); // null until the screen size is known

  useEffect(() => {
    let engine: LibraryEngine | null = null;
    let cancelled = false;
    (async () => {
      try {
        // fonts and the 3d code load in parallel
        const [{ LibraryEngine }] = await Promise.all([
          import("../../../engine"),
          ...FONT_FACES.map((f) => document.fonts.load(f)),
        ]);
        const { root, shelf, hero, detailSlot, readerSlot } = refs;
        if (cancelled || !root.current || !shelf.current || !hero.current)
          return;
        engine = new LibraryEngine(
          root.current,
          shelf.current,
          hero.current,
          FONTS,
          {
            onHandle: (id, pose) => setHandle(id && pose ? { id, pose } : null),
            onMode: (m, id) => {
              setMode(m);
              if (id) setActiveId(id);
            },
            onHeaderRect: setHeader,
            onBackend: setBackend,
            onShelved: setShelved,
            onLost: () => setEpoch((e) => e + 1),
            getSlot: (m) =>
              (m === "reader"
                ? readerSlot.current
                : detailSlot.current
              )?.getBoundingClientRect() ?? null,
          },
        );
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
    // refs are stable objects, only a gpu loss restarts the engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epoch]);

  return {
    engineRef,
    status,
    backend,
    header,
    handle,
    mode,
    activeId,
    setActiveId,
    shelved,
  };
}
