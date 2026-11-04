import { GENRES, ROMAN } from "../../data/genres";

export { GENRES, ROMAN };

// label used by the book list and the fallback, the plaques draw their own spaced version
export const genreTitle = (i: number) => `${ROMAN[i]} · ${GENRES[i]}`;
