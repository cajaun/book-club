import type { Fonts } from "../../../artwork";

// family names as css knows them, the files load through fontsource in the root layout
export const FONTS: Fonts = {
  serif: '"Cormorant Garamond"',
  caps: '"Cinzel"',
  sans: '"Jost"',
};

// every weight the artwork draws with, canvas text needs them loaded before drawing
export const FONT_FACES = [
  '500 20px "Cormorant Garamond"',
  '600 20px "Cormorant Garamond"',
  '700 20px "Cormorant Garamond"',
  'italic 500 20px "Cormorant Garamond"',
  'italic 600 20px "Cormorant Garamond"',
  '500 20px "Cinzel"',
  '600 20px "Cinzel"',
  '500 20px "Jost"',
  '600 20px "Jost"',
];
