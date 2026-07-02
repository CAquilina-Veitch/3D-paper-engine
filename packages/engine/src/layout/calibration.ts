import { type Doc, slotWidth } from "@paper3d/model";
import type { PageOp } from "./pageProgram";

/**
 * Calibration block: a 100mm ruler to verify print scaling, and a slot-test
 * comb so the builder can confirm the slot width grips their cardstock
 * before cutting 40 pieces.
 */
export function calibrationOps(doc: Doc, x: number, y: number): PageOp[] {
  const ops: PageOp[] = [];

  ops.push({
    kind: "text",
    at: [x, y],
    text: "Calibration — print at 100% scale (no 'fit to page')",
    sizePt: 10,
    color: "black",
  });

  // 100mm ruler with 10mm ticks.
  const rulerY = y + 8;
  ops.push({ kind: "line", from: [x, rulerY], to: [x + 100, rulerY], style: "cut" });
  for (let mm = 0; mm <= 100; mm += 10) {
    ops.push({
      kind: "line",
      from: [x + mm, rulerY],
      to: [x + mm, rulerY - (mm % 50 === 0 ? 4 : 2.5)],
      style: "cut",
    });
  }
  ops.push({
    kind: "text",
    at: [x + 104, rulerY - 1],
    text: "this ruler must measure exactly 100mm",
    sizePt: 7,
    color: "gray",
  });

  // Slot-test comb: the configured width ±0.10 in 0.05 steps.
  const w = slotWidth(doc.print);
  const combY = y + 16;
  const combH = 15;
  const combW = 60;
  const deltas = [-0.1, -0.05, 0, 0.05, 0.1];
  const spacing = combW / (deltas.length + 1);
  const outline: [number, number][][] = [];

  const rect: [number, number][] = [
    [x, combY],
    [x + combW, combY],
    [x + combW, combY + combH],
    [x, combY + combH],
  ];
  outline.push(rect);
  deltas.forEach((d, i) => {
    const sw = Math.max(0.05, w + d);
    const cx = x + spacing * (i + 1);
    outline.push([
      [cx - sw / 2, combY],
      [cx + sw / 2, combY],
      [cx + sw / 2, combY + combH / 2],
      [cx - sw / 2, combY + combH / 2],
    ]);
    ops.push({
      kind: "text",
      at: [cx, combY + combH + 4],
      text: sw.toFixed(2),
      sizePt: 6,
      color: "gray",
      anchor: "middle",
    });
  });
  ops.push({ kind: "path", rings: outline, style: "cut" });
  ops.push({
    kind: "text",
    at: [x + combW + 6, combY + combH / 2],
    text: `cut this comb; the notch that grips your card is your slot width (set: ${w.toFixed(2)}mm)`,
    sizePt: 7,
    color: "gray",
  });

  return ops;
}
