import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { type PageOps, type PageProgram, STYLE_WIDTH_PT } from "../layout/pageProgram";

const MM_TO_PT = 72 / 25.4;
const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0, 0, 0);

/** Render the whole program to PDF bytes (vector, exact mm scale). */
export async function renderPdf(program: PageProgram): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const pageOps of program.pages) {
    const W = pageOps.widthMm * MM_TO_PT;
    const H = pageOps.heightMm * MM_TO_PT;
    const page = doc.addPage([W, H]);
    // Page-space mm (y down) → PDF pt (y up).
    const px = (mm: number) => mm * MM_TO_PT;
    const py = (mm: number) => H - mm * MM_TO_PT;

    for (const op of pageOps.ops) {
      switch (op.kind) {
        case "path": {
          for (const ring of op.rings) {
            if (ring.length < 2) continue;
            // drawSvgPath consumes y-down coordinates measured from its (x, y) origin.
            const d = `M${ring.map(([x, y]) => `${px(x).toFixed(3)},${px(y).toFixed(3)}`).join("L")}Z`;
            page.drawSvgPath(d, {
              x: 0,
              y: H,
              borderColor: BLACK,
              borderWidth: STYLE_WIDTH_PT[op.style],
              borderDashArray: op.dashed ? [3.4, 2.3] : undefined,
            });
          }
          break;
        }
        case "line": {
          page.drawLine({
            start: { x: px(op.from[0]), y: py(op.from[1]) },
            end: { x: px(op.to[0]), y: py(op.to[1]) },
            color: BLACK,
            thickness: STYLE_WIDTH_PT[op.style],
            dashArray: op.dashed ? [3.4, 2.3] : undefined,
          });
          break;
        }
        case "circle": {
          page.drawCircle({
            x: px(op.at[0]),
            y: py(op.at[1]),
            size: op.r * MM_TO_PT,
            color: op.filled ? GRAY : undefined,
            borderColor: op.filled ? undefined : GRAY,
            borderWidth: op.filled ? undefined : STYLE_WIDTH_PT[op.style],
          });
          break;
        }
        case "text": {
          const size = op.sizePt;
          const color = op.color === "gray" ? GRAY : BLACK;
          const rot = op.rotateDeg ?? 0;
          let x = px(op.at[0]);
          let y = py(op.at[1]);
          if (op.anchor === "middle") {
            const width = font.widthOfTextAtSize(op.text, size);
            // Shift back along the text's running direction (SVG rotation is
            // clockwise in y-down space → direction (cos, sin) in page mm).
            const rad = (rot * Math.PI) / 180;
            x -= (Math.cos(rad) * width) / 2;
            y += (Math.sin(rad) * width) / 2;
          }
          page.drawText(op.text, {
            x,
            y,
            size,
            font,
            color,
            rotate: degrees(-rot),
          });
          break;
        }
      }
    }
  }

  return doc.save();
}

export function pagePixelSize(page: PageOps): { width: number; height: number } {
  return { width: page.widthMm * MM_TO_PT, height: page.heightMm * MM_TO_PT };
}
