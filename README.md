# GK Book Club

A 3D bookshop shelf. Real 3D books you can pick up and rearrange. Tap one and it flies off the shelf for a closer look, then opens to its first page.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

- `?webgl`: forces the WebGL2 fallback, so you can test it on a WebGPU machine.
- `?debug`: exposes the engine as `window.__shelf` for console poking.

## Interactions

| Gesture | What happens |
| --- | --- |
| (no scrolling or zoom) | The bookcase always shows exactly five shelves in one column: edge to edge on phones, centred on desktop. |
| Drag a book with the mouse (or long-press it on touch) | The book lifts and tilts with the motion. Neighbours part to show where it will land. It can go to another shelf, and a laid-flat book dropped on a stack joins the stack. |
| Header toggle while a book is in hand | Spine out / Face out / Laid flat |
| Tap the book in hand | Cycles its pose ("tap to stand it up") |
| Tap any other book | It slides out of its slot (or off its stack), turns, and flies to the reader. The shelf blurs and the detail panel appears. |
| ‹ › or arrow keys | Previous / next book |
| Read a page | Turned off for now. The reader still exists in the engine (`openReader()`) but has no button. |
| Close the book / Close / Esc | Reverses all of the above; the book flies back to its exact slot |

## Architecture

```
lib/books.ts      manifest: catalogue + initial arrangement (single source of truth)
lib/layout.ts     pure solver: arrangement -> world transform per book; bay geometry
lib/textures.ts   Canvas2D art: spines, covers, title pages, wood, plaques, atlas packer
lib/engine.ts     three.js WebGPURenderer, springs, picking, drag, hero flight
components/Library.tsx   React: crown header, pose control, detail/reader panels,
                         search, bag, accessible book list, no-GPU fallback
```

- **Renderer.** three.js `WebGPURenderer`. It uses WebGPU where available and falls back to WebGL2 automatically, with the same scene code on both. If neither works, there's a DOM fallback. If the GPU device is lost, the engine rebuilds itself.
- **Two canvases.** The shelf canvas renders on demand, only while something moves. A transparent hero canvas sits above a CSS `backdrop-filter` blur layer. Both use one camera, so the hand-off from shelf to hero is pixel-identical.
- **One material for every book.** All spines and covers are drawn into a single texture atlas with Canvas2D at load, so nothing is downloaded. Each book is a box whose UVs point into the atlas. The hero book is a separate, detailed model: hinged front board, page block, endpapers and title page drawn at 40 px/cm.
- **Five shelves, one column.** `fitFrame()` sizes the single bookcase to the screen: on phones and tablets it fills the width edge to edge (the header board grows to use spare height); on desktop it stands in the middle of the room, as tall as the window. Each shelf holds three genres in sequence; whatever doesn't fit stays off-shelf (and out of search).
- **Colour.** Lights are balanced so a book facing you shows its own colours (~0.9×), with Khronos Neutral tone mapping and matte (Lambert) book materials; wall, wood and palette are sampled from the reference video.
- **Free placement.** Every book has a real position along its shelf (`Entry.x`). Drop one anywhere and it stays exactly there; neighbours move only if it actually touches them, pushed away from it. Books keep their order by centre, so a book laid flat or turned face-out in place pushes both sides evenly. Shelves start with ~29 cm spare, so laying any one book flat only squeezes gaps; only a genuinely full shelf drops its last book into storage.
- **Layout is data.** Dragging, stacking and pose changes only edit `Entry[][]`. `layoutAll()` returns targets, and critically damped springs (fixed 240 Hz sub-steps) animate towards them.
- **The DOM drives 3D placement.** The detail and reader views contain empty slot elements, and the hero book is fitted to the slot's rectangle every frame. Responsive layout is therefore just CSS.
- **Accessibility and SEO.** A real list of every book is server-rendered as buttons. Keyboard focus highlights the book on the shelf, Enter opens it, and Esc closes it. `prefers-reduced-motion` shortens every flight.
- **Weight.** The first load is ~112 kB. The 3D code loads lazily after paint and is ~270 kB gzipped. There are no images or wasm.
