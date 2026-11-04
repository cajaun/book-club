import type { RefObject } from "react";
import { formatYear, type Book } from "../../../domain/catalog";

interface Props {
  book: Book | null;
  open: boolean;
  slotRef: RefObject<HTMLDivElement>; // the engine fits the close-up book into this box
  onClose(): void;
  onStep(dir: 1 | -1): void;
}

export function DetailPanel({ book, open, slotRef, onClose, onStep }: Props) {
  const tab = open ? 0 : -1;
  return (
    <section
      className="detail"
      aria-hidden={!open}
      aria-label={book ? `${book.title} details` : undefined}
    >
      <button className="close-x" onClick={onClose} tabIndex={tab}>
        Close
      </button>
      <div className="detail-col">
        <div className="slot-row">
          <button
            className="arrow"
            aria-label="Previous book"
            tabIndex={tab}
            onClick={() => onStep(-1)}
          >
            ‹
          </button>
          <div className="slot" ref={slotRef} />
          <button
            className="arrow"
            aria-label="Next book"
            tabIndex={tab}
            onClick={() => onStep(1)}
          >
            ›
          </button>
        </div>
        {book && (
          <div className="meta" key={book.id}>
            <p className="genre">{book.genre}</p>
            <h2>{book.title}</h2>
            <p className="author">{book.author}</p>
            <p className="facts">
              {formatYear(book.year)} · {book.pages} pages · Collector&rsquo;s
              edition
            </p>
            <p className="blurb">{book.blurb}</p>
          </div>
        )}
      </div>
    </section>
  );
}
