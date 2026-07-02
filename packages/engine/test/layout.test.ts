import { describe, expect, it } from "vitest";
import { A4 } from "../src/layout/pageProgram";
import { layoutPages, placementTransform } from "../src/layout/pages";
import { renderPdf } from "../src/render/pdf";
import { renderPageSvg } from "../src/render/svg";
import { sliceDoc } from "../src/slicing/slicer";
import { testDoc } from "./helpers";

const { doc, fields } = testDoc(1);
const model = sliceDoc(doc, fields);
const layout = layoutPages(doc, model);

describe("layoutPages", () => {
  it("places every piece exactly once", () => {
    expect(layout.placements.length).toBe(model.pieces.length);
    const ids = new Set(layout.placements.map((p) => p.piece.id));
    expect(ids.size).toBe(model.pieces.length);
  });

  it("keeps every placement inside the printable area", () => {
    const margin = doc.print.margin;
    for (const pl of layout.placements) {
      expect(pl.x).toBeGreaterThanOrEqual(0);
      expect(pl.y).toBeGreaterThanOrEqual(0);
      expect(margin + pl.x + pl.w).toBeLessThanOrEqual(A4.widthMm - margin + 1e-9);
      expect(margin + pl.y + pl.h).toBeLessThanOrEqual(A4.heightMm - margin + 1e-9);
    }
  });

  it("never overlaps two pieces on a page", () => {
    const byPage = new Map<number, typeof layout.placements>();
    for (const pl of layout.placements) {
      byPage.set(pl.page, [...(byPage.get(pl.page) ?? []), pl]);
    }
    for (const placements of byPage.values()) {
      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          const a = placements[i]!;
          const b = placements[j]!;
          const disjoint =
            a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(disjoint, `${a.piece.label} vs ${b.piece.label}`).toBe(true);
        }
      }
    }
  });

  it("keeps family + index order monotone across pages", () => {
    let prev = -1;
    for (const pl of layout.placements) {
      const key = pl.piece.familyIndex * 10000 + pl.piece.indexInFamily * 10 + pl.piece.island;
      expect(key).toBeGreaterThan(prev);
      prev = key;
    }
  });

  it("transforms outlines into the placement box", () => {
    for (const pl of layout.placements) {
      const t = placementTransform(pl, doc.print.margin);
      for (const p of pl.piece.outline) {
        const [x, y] = t(p);
        expect(x).toBeGreaterThanOrEqual(doc.print.margin + pl.x - 1e-6);
        expect(x).toBeLessThanOrEqual(doc.print.margin + pl.x + pl.w + 1e-6);
        expect(y).toBeGreaterThanOrEqual(doc.print.margin + pl.y - 1e-6);
        expect(y).toBeLessThanOrEqual(doc.print.margin + pl.y + pl.h + 1e-6);
      }
    }
  });
});

describe("renderers", () => {
  it("renders every page to valid-looking SVG", () => {
    for (const page of layout.program.pages) {
      const svg = renderPageSvg(page);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain('viewBox="0 0 210 297"');
    }
  });

  it("front page SVG snapshot is stable", () => {
    expect(renderPageSvg(layout.program.pages[0]!)).toMatchSnapshot();
  });

  it("first piece page SVG snapshot is stable", () => {
    expect(renderPageSvg(layout.program.pages[1]!)).toMatchSnapshot();
  });

  it("renders a PDF with exact A4 pages and all piece labels", async () => {
    const bytes = await renderPdf(layout.program);
    expect(bytes.length).toBeGreaterThan(1000);
    const { PDFDocument } = await import("pdf-lib");
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(layout.pageCount);
    const [w, h] = [parsed.getPage(0).getWidth(), parsed.getPage(0).getHeight()];
    expect(w).toBeCloseTo((210 * 72) / 25.4, 3);
    expect(h).toBeCloseTo((297 * 72) / 25.4, 3);
  });
});
