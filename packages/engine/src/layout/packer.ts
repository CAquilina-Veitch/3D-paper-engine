import type { Piece } from "../slicing/slicer";

export interface Placement {
  piece: Piece;
  page: number;
  /** Page-space mm of the piece bbox's top-left corner after rotation. */
  x: number;
  y: number;
  rotDeg: 0 | 90;
  /** Placed size, mm. */
  w: number;
  h: number;
}

export interface PackResult {
  placements: Placement[];
  pageCount: number;
}

/**
 * Order-preserving shelf packer (first-fit-decreasing-height without
 * reordering). Assembly sanity beats packing density for hand cutting:
 * pieces stay in family + index order across shelves and pages, so the
 * printed sheets read A1, A2, … B1, B2 top-to-bottom.
 */
export function packPieces(
  pieces: Piece[],
  usableW: number,
  usableH: number,
  gutter: number,
): PackResult {
  const ordered = pieces
    .slice()
    .sort(
      (a, b) =>
        a.familyIndex - b.familyIndex || a.indexInFamily - b.indexInFamily || a.island - b.island,
    );

  const placements: Placement[] = [];
  let page = 0;
  let shelfY = 0;
  let shelfH = 0;
  let cursorX = 0;

  for (const piece of ordered) {
    const bw = piece.bbox.maxX - piece.bbox.minX;
    const bh = piece.bbox.maxY - piece.bbox.minY;
    // Prefer unrotated; rotate 90° only when that's the only way to fit the sheet.
    const rot: 0 | 90 = bw <= usableW && bh <= usableH ? 0 : 90;
    const w = rot === 0 ? bw : bh;
    const h = rot === 0 ? bh : bw;

    if (cursorX > 0 && cursorX + w > usableW) {
      shelfY += shelfH + gutter;
      cursorX = 0;
      shelfH = 0;
    }
    if (shelfY + h > usableH) {
      page += 1;
      shelfY = 0;
      cursorX = 0;
      shelfH = 0;
    }
    placements.push({ piece, page, x: cursorX, y: shelfY, rotDeg: rot, w, h });
    cursorX += w + gutter;
    shelfH = Math.max(shelfH, h);
  }

  return { placements, pageCount: placements.length ? page + 1 : 0 };
}
