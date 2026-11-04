"use client";

import { useEffect, type RefObject } from "react";

// paints the stage with the bookcase's own side-panel wood through a css variable
export function useWoodBackground(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    let live = true;
    import("../../../artwork").then(({ drawWoodVertical }) => {
      if (!live) return;
      const url = drawWoodVertical(256, 512).toDataURL("image/jpeg", 0.82);
      ref.current?.style.setProperty("--wood", `url(${url})`);
    });
    return () => {
      live = false;
    };
  }, [ref]);
}
