import type { Doc } from "@paper3d/model";
import type { Vec2 } from "../geom2/types";
import type { Piece, SlicedModel } from "../slicing/slicer";
import { assemblyMapOps } from "./assemblyMap";
import { calibrationOps } from "./calibration";
import { type PackResult, type Placement, packPieces } from "./packer";
import { A4, type PageOp, type PageOps, type PageProgram } from "./pageProgram";

export interface LayoutResult {
  program: PageProgram;
  placements: Placement[];
  pageCount: number;
}

const INSTRUCTIONS = [
  "1. Cut the comb above and check which notch grips your cardstock; reprint with an adjusted",
  "   paper thickness setting if the middle notch is loose or tight.",
  "2. Cut every piece on the following pages along the solid outlines (slots too).",
  "3. Family A slots open UP (cut from the top edge), family B slots open DOWN.",
  "4. Stand the A pieces in order (A1, A2, ...), then slide each B piece down across them,",
  "   matching the crossings shown on the map. Work from one side to the other.",
  "5. Dashed pieces carry warnings (thin or fragile spots) — cut those carefully.",
];

/** Map a piece's plane-local (u, v-up) outline into page mm (y-down). */
export function placementTransform(pl: Placement, margin: number): (p: Vec2) => Vec2 {
  const { piece, rotDeg } = pl;
  const ox = margin + pl.x;
  const oy = margin + pl.y;
  const { minX, maxY, minY } = piece.bbox;
  const bh = maxY - minY;
  if (rotDeg === 0) {
    return ([u, v]) => [ox + (u - minX), oy + (maxY - v)];
  }
  // 90° clockwise: local (lx, ly) → (bh - ly, lx).
  return ([u, v]) => {
    const lx = u - minX;
    const ly = maxY - v;
    return [ox + (bh - ly), oy + lx];
  };
}

export function layoutPages(doc: Doc, model: SlicedModel): LayoutResult {
  const margin = doc.print.margin;
  const usableW = A4.widthMm - 2 * margin;
  const usableH = A4.heightMm - 2 * margin;

  const pack: PackResult = packPieces(model.pieces, usableW, usableH, doc.print.gutter);
  const pages: PageOps[] = [];

  // Page 1 — calibration, instructions, assembly map.
  const front: PageOp[] = [];
  front.push({
    kind: "text",
    at: [margin, margin + 2],
    text: doc.name,
    sizePt: 14,
    color: "black",
  });
  front.push(...calibrationOps(doc, margin, margin + 12));
  let cursorY = margin + 52;
  for (const line of INSTRUCTIONS) {
    front.push({ kind: "text", at: [margin, cursorY], text: line, sizePt: 8, color: "black" });
    cursorY += 4.2;
  }
  front.push(...assemblyMapOps(doc, model, margin, cursorY + 10, Math.min(usableW, 150)));
  pages.push({ ...A4, ops: front });

  // Piece pages.
  for (let p = 0; p < pack.pageCount; p++) {
    const ops: PageOp[] = [];
    for (const pl of pack.placements) {
      if (pl.page !== p) continue;
      ops.push(...pieceOps(pl, margin));
    }
    pages.push({ ...A4, ops });
  }

  // Footers.
  pages.forEach((page, i) => {
    page.ops.push({
      kind: "text",
      at: [margin, A4.heightMm - margin + 5],
      text: `${doc.name} — page ${i + 1} of ${pages.length} — paper ${doc.print.paperThickness.toFixed(2)}mm + kerf ${doc.print.kerf.toFixed(2)}mm`,
      sizePt: 7,
      color: "gray",
    });
  });

  return { program: { pages }, placements: pack.placements, pageCount: pages.length };
}

function pieceOps(pl: Placement, margin: number): PageOp[] {
  const t = placementTransform(pl, margin);
  const piece = pl.piece;
  const ops: PageOp[] = [];

  ops.push({
    kind: "path",
    rings: [piece.outline.map(t), ...piece.holes.map((h) => h.map(t))],
    style: "cut",
    dashed: piece.warnings.length > 0,
  });

  const anchor = t(piece.labelAnchor);
  const sizePt = piece.labelClearance >= 2.2 ? 7 : 6;
  if (piece.labelClearance >= 1.4) {
    ops.push({
      kind: "text",
      at: anchor,
      text: piece.label,
      sizePt,
      rotateDeg: pl.rotDeg === 90 ? 90 : 0,
      color: "gray",
      anchor: "middle",
    });
  } else {
    // Piece too skinny for an inside label: put it beside the piece with a leader dot.
    ops.push({ kind: "circle", at: anchor, r: 0.4, style: "faint", filled: true });
    ops.push({
      kind: "text",
      at: [margin + pl.x + pl.w + 1, margin + pl.y + 3],
      text: piece.label,
      sizePt: 6,
      color: "gray",
    });
  }

  // Orientation tick: a short line pointing model-up from the piece's bottom edge.
  const upFrom = t([piece.labelAnchor[0], piece.bbox.minY]);
  const upTo = t([piece.labelAnchor[0], piece.bbox.minY + 2.5]);
  ops.push({ kind: "line", from: upFrom, to: upTo, style: "faint" });
  ops.push({ kind: "circle", at: upTo, r: 0.3, style: "faint", filled: true });

  return ops;
}
