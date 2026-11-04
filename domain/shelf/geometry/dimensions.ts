// bookcase measurements in cm and shared camera constants, free of three so 2d code can use them

export const CASE = {
  W: 108, // default interior width before the screen is measured
  compH: 31.5, // clear height of a compartment, the tallest book is 30
  board: 2.8, // shelf board thickness
  depth: 28, // interior depth, the back wall sits at z = -depth
  shelves: 5, // rows of books
  plinth: 9,
  side: 5, // side panel thickness
  cornice: 2.4,
};

// top surface of row r, row 0 is the top shelf
export const surfaceY = (r: number) => (CASE.shelves - 1 - r) * (CASE.compH + CASE.board);
export const interiorTop = CASE.shelves * CASE.compH + (CASE.shelves - 1) * CASE.board;

export const FOV = 20; // camera field of view in degrees
export const FRONT_Z = 1.5; // the camera frames the case's front edge at this depth
