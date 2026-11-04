// small browser helpers

// true when the page url carries ?name or &name
export const hasFlag = (name: string) => typeof location !== "undefined" && new RegExp(`[?&]${name}\\b`).test(location.search);

// resolves after n animation frames so long work can yield to the page
export const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = () => (n-- <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
