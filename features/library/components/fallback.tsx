import { BOOKS, GENRES, genreTitle } from "../../../domain/catalog";

// a flat dom bookcase for browsers with neither webgpu nor webgl2
export function Fallback({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="fallback">
      <h1>GK Book Club</h1>
      {GENRES.map((name, g) => (
        <section key={name}>
          <h2>{genreTitle(g)}</h2>
          <div className="fallback-row">
            {BOOKS.filter((b) => b.genreIndex === g).map((b) => (
              <button
                key={b.id}
                style={{ background: b.base, color: b.ink }}
                onClick={() => onOpen(b.id)}
              >
                {b.title}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
