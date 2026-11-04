import type { RefObject } from "react";
import type { Book } from "../../../domain/catalog";

interface Props {
  book: Book | null;
  open: boolean;
  slotRef: RefObject<HTMLDivElement>;
  onClose(): void; // back to the shelf
  onCloseBook(): void; // back to the detail view
}

// the book opened to its title page, nothing opens it at the moment
export function ReaderPanel({
  book,
  open,
  slotRef,
  onClose,
  onCloseBook,
}: Props) {
  const tab = open ? 0 : -1;
  return (
    <section className="reader" aria-hidden={!open}>
      <button className="close-x" onClick={onClose} tabIndex={tab}>
        Close
      </button>
      <div className="reader-slot" ref={slotRef} />
      {book && open && (
        <p className="sr-only">{`${book.title}, first page: ${book.blurb}`}</p>
      )}
      <button
        className="pill ghost close-book"
        tabIndex={tab}
        onClick={onCloseBook}
      >
        Close the book
      </button>
    </section>
  );
}
