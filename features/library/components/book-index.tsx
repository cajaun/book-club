import { BOOKS, GENRES, formatYear, genreTitle } from "../../../domain/catalog";

interface Props {
  shelved: Set<string> | null;
  onFocusBook(id: string | null): void; // highlights the book on the 3d shelf
  onOpen(id: string): void;
}

// the real crawlable, keyboard-reachable list of books, the 3d shelf enhances it
export function BookIndex({ shelved, onFocusBook, onOpen }: Props) {
  return (
    <nav className="sr-only" aria-label="Books on the shelves">
      {GENRES.map((name, g) => (
        <section key={name}>
          <h3>{genreTitle(g)}</h3>
          <ul>
            {BOOKS.filter(
              (b) => b.genreIndex === g && (!shelved || shelved.has(b.id)),
            ).map((b) => (
              <li key={b.id}>
                <button
                  id={`book-${b.id}`}
                  onFocus={() => onFocusBook(b.id)}
                  onBlur={() => onFocusBook(null)}
                  onClick={() => onOpen(b.id)}
                >
                  {b.title} by {b.author}, {formatYear(b.year)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
