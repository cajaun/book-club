// all artwork is drawn with canvas 2d so the site ships no image files

export * from "./primitives/canvas";
export { drawSpine } from "./book/spine";
export { drawCover } from "./book/cover";
export { drawBack, drawPages, drawTitlePage, drawEndpaper } from "./book/pages";
export { drawWood, drawWoodVertical, drawBackWall, drawPlaque } from "./bookcase";
export { buildAtlas, type Atlas, type BookRegions, type Rect } from "./atlas";
