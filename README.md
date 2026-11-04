# GK Book Club

A 3D bookshop shelf. Real 3D books you can pick up and rearrange. Tap one and it flies off the shelf for a closer look.

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
| Swipe, wheel or trackpad | Scrolls the bookcase vertically. There is no pinch zoom. |
| Drag a book with the mouse (or long-press it on touch) | The book lifts and tilts with the motion. Neighbours part to show where it will land. It can go to another shelf, and a laid-flat book dropped on a stack joins the stack. |
| Pose control while a book is in hand | Spine out / Face out / Laid flat |
| Tap the book in hand | Cycles its pose ("tap to stand it up") |
| Tap any other book | It slides out of its slot (or off its stack), turns, and flies to the reader. The shelf blurs and the detail panel appears. |
| ‹ › or arrow keys | Previous / next book |
| Read a page | Turned off for now. The reader still exists in the engine (`openReader()`) but has no button. |
| Close the book / Close / Esc | Reverses all of the above; the book flies back to its exact slot |

## Architecture

```
src/
  app/                  Next.js routes only: root layout and the page
  features/
    library/            the bookshop page in React
      components/       library, pose-control, detail-panel, reader-panel, search-dialog, book-index, fallback
      hooks/            use-library-engine, use-keyboard, use-wood-background
      config/           fonts
      styles/           CSS for the stage, crown, panels, search and fallback
  engine/               the 3D scene (three.js)
    library-engine.ts   wires the parts below and runs the frame loop
    camera/             shared camera, scrolling, picking, screen to world maths
    render/             renderer setup, light rig, bookcase furniture, world-mapped wood
    books/              book meshes, per-book state, springs and pose-change paths
    shelf/              keeps the arrangement in sync with the books on screen
    hero/               the close-up book: model, art, placement, open/close/step flights
    interaction/        pointer input, drag and drop, hover and the book in hand
    core/               easing, flight curve, small browser helpers
  artwork/              Canvas2D drawing
    primitives/         canvas, colour, text and decorative marks
    book/               spine, cover, pages
    bookcase.ts         wood, back wall, plaques
    atlas.ts            packs every book's art into one texture
  domain/               pure logic, no DOM and no React
    catalog/            builds books from the data, starting arrangement
    shelf/
      geometry/         case dimensions and screen framing
      layout/           row solver and book placement
      arrangement/      starting rows, lookups, edits, where a carried book can land
  data/                 static content: titles, genres, palette, hand-made arrangements
  styles/               global CSS (Tailwind and design tokens)
  types/                ambient declarations
```

Each layer only imports from the layers below it: `data` → `domain` → `artwork` → `engine` → `features` → `app`. Files are kebab-case.

`data` and `domain` use neither the DOM nor React, so the shelf logic can be tested on its own.

- **Renderer.** three.js `WebGPURenderer`. It uses WebGPU where available and falls back to WebGL2 automatically, with the same scene code on both. If neither works, there's a DOM fallback. If the GPU device is lost, the engine rebuilds itself and removes its old event listeners.
- **Two canvases.** The shelf canvas renders on demand, only while something moves. A transparent hero canvas sits above the blurred shelf. Both use one camera, so the hand-off from shelf to hero is pixel-identical.
- **One material per atlas page.** Spines and covers are drawn into a texture atlas with Canvas2D at load, so nothing is downloaded. Each book is a box whose UVs point into the atlas. The hero book is a separate, detailed model: hinged front board, page block, endpapers and title page drawn at 40 px/cm.
- **Five shelves, one column.** `fitFrame()` sizes the bookcase to the screen: on phones it fills the width edge to edge; on desktop it stands in the middle of a wood-panelled room. Each shelf holds three genres in sequence; whatever doesn't fit stays off-shelf (and out of search).
- **Colour.** Lights are balanced so a book facing you shows its own colours (~0.9×), with Khronos Neutral tone mapping and matte (Lambert) book materials. The hero's lights turn with the book so it looks the same in the hand as on the shelf.
- **Free placement.** Every book has a real position along its shelf (`Entry.x`). Drop one anywhere and it stays there; neighbours move only if it touches them. A full shelf sends the book to the nearest shelf with room.
- **Loading.** "Dusting the shelves…" shows while the engine starts and draws each atlas page in turn, yielding between pages so the page stays responsive.
- **Layout is data.** Dragging, stacking and pose changes only edit `Entry[][]` (see `src/domain/shelf/arrangement/`). `layoutAll()` returns targets, and springs with fixed 240 Hz sub-steps animate towards them.
- **The DOM drives 3D placement.** The detail and reader views contain empty slot elements, and the hero book is fitted to the slot's rectangle every frame. Responsive layout is therefore just CSS.
- **Accessibility and SEO.** A real list of every book is server-rendered as buttons. Keyboard focus highlights the book on the shelf, Enter opens it, and Esc closes it. `prefers-reduced-motion` shortens every flight.
