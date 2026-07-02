import { describe, expect, it } from "vitest";
import { planeCrossings } from "../src/slicing/crossings";
import { type Piece, type SlicedModel, sliceDoc } from "../src/slicing/slicer";
import { testDoc, verticalIntervals } from "./helpers";

function slice(seed = 1, spacing = 8): SlicedModel {
  const { doc, fields } = testDoc(seed, spacing);
  return sliceDoc(doc, fields);
}

function pieceForPlane(model: SlicedModel, planeId: string, u: number): Piece | undefined {
  return model.pieces.find(
    (p) => p.planeId === planeId && u >= p.bbox.minX - 1 && u <= p.bbox.maxX + 1,
  );
}

describe("sliceDoc on the default egg-crate terrain", () => {
  const model = slice();

  it("produces both families with expected plane counts", () => {
    // 160mm world, 8mm spacing, half-spacing phase → planes at 4..156 = 20 per family.
    const familyA = model.pieces.filter((p) => p.familyIndex === 0);
    const familyB = model.pieces.filter((p) => p.familyIndex === 1);
    expect(familyA.length).toBe(20);
    expect(familyB.length).toBe(20);
  });

  it("gives every piece a closed, non-trivial outline", () => {
    for (const p of model.pieces) {
      expect(p.outline.length).toBeGreaterThanOrEqual(4);
      expect(p.bbox.maxX - p.bbox.minX).toBeGreaterThan(100);
      // Base pedestal means every piece reaches below y=0.
      expect(p.bbox.minY).toBeLessThan(0);
    }
  });

  it("pairs every slot with a mate of equal vMid/width and complementary opening", () => {
    for (const piece of model.pieces) {
      for (const slot of piece.slots) {
        const mate = pieceForPlane(model, slot.mate.planeId, slot.mate.u);
        expect(mate, `mate piece for slot on ${piece.label}`).toBeDefined();
        const mateSlot = mate!.slots.find(
          (s) => s.mate.planeId === piece.planeId && Math.abs(s.mate.u - slot.u) < 1e-6,
        );
        expect(mateSlot, `mate slot on ${mate!.label} for ${piece.label}`).toBeDefined();
        expect(mateSlot!.vMid).toBeCloseTo(slot.vMid, 6);
        expect(mateSlot!.width).toBeCloseTo(slot.width, 6);
        expect(mateSlot!.opening).not.toBe(slot.opening);
      }
    }
  });

  it("has no severed pieces or slot collisions with default settings", () => {
    expect(model.warnings.filter((w) => w.type === "triple-intersection")).toEqual([]);
    for (const p of model.pieces) {
      expect(p.warnings.filter((w) => w.type === "severed")).toEqual([]);
      expect(p.island).toBe(0);
    }
  });

  it("assembly simulation: mating pieces are complementary at every crossing", () => {
    const crossings = planeCrossings(model.planes);
    let checked = 0;
    for (const crossing of crossings) {
      const pieceA = pieceForPlane(model, crossing.a.id, crossing.uA);
      const pieceB = pieceForPlane(model, crossing.b.id, crossing.uB);
      if (!pieceA || !pieceB) continue;
      const slotA = pieceA.slots.find((s) => Math.abs(s.u - crossing.uA) < 1e-6);
      if (!slotA) continue; // crossing skipped (outside solid / too shallow)

      const ivA = verticalIntervals(pieceA.outline, pieceA.holes, crossing.uA);
      const ivB = verticalIntervals(pieceB.outline, pieceB.holes, crossing.uB);
      expect(ivA.length).toBe(1);
      expect(ivB.length).toBe(1);
      const [aLo, aHi] = ivA[0]!;
      const [bLo, bHi] = ivB[0]!;
      // A opens top (keeps bottom half), B opens bottom (keeps top half).
      const [keepBottom, keepTop] =
        slotA.opening === "top" ? [ivA[0]!, ivB[0]!] : [ivB[0]!, ivA[0]!];
      expect(keepBottom[1]).toBeCloseTo(slotA.vMid, 3);
      expect(keepTop[0]).toBeCloseTo(slotA.vMid, 3);
      // Together they span the full shared extent with no overlap beyond the midline.
      expect(Math.min(aLo, bLo)).toBeLessThan(slotA.vMid);
      expect(Math.max(aHi, bHi)).toBeGreaterThan(slotA.vMid);
      checked++;
    }
    expect(checked).toBeGreaterThan(200); // 19×19 crossings, most inside the solid
  });

  it("volume sanity: family A piece area ≈ family B piece area", () => {
    const area = (familyIndex: number) =>
      model.pieces
        .filter((p) => p.familyIndex === familyIndex)
        .reduce((acc, p) => acc + Math.abs(ringAreaOf(p.outline)), 0);
    const a = area(0);
    const b = area(1);
    // Slot cuts differ between families (top vs bottom), so allow a few percent.
    expect(Math.abs(a - b) / a).toBeLessThan(0.05);
  });
});

describe("determinism", () => {
  it("same seed → identical model; different seed → different pieces", () => {
    const a1 = slice(5);
    const a2 = slice(5);
    expect(JSON.stringify(a1.pieces.map((p) => p.outline))).toBe(
      JSON.stringify(a2.pieces.map((p) => p.outline)),
    );
    const b = slice(6);
    expect(JSON.stringify(a1.pieces[0]!.outline)).not.toBe(JSON.stringify(b.pieces[0]!.outline));
  });
});

function ringAreaOf(ring: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}
