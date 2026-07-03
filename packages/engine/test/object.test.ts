import { type Doc, type ObjectLayer, defaultDoc, newObjectLayer } from "@paper3d/model";
import { describe, expect, it } from "vitest";
import { sliceDoc } from "../src/slicing/slicer";
import { objectSampler } from "../src/solid/object";

const world = { width: 160, depth: 160 };

/** A centered box object: top rect, front rect (x,y), side rect (z,y). */
function boxLayer(): ObjectLayer {
  const layer = newObjectLayer("Box", world);
  layer.transform = { x: 50, y: 0, z: 50, rotY: 0, scale: 1 }; // 60x80 box at (50,50)
  layer.size = { width: 60, height: 40, depth: 80 };
  const rect = (w: number, h: number) =>
    [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ] as [number, number][];
  layer.top = { shapes: [rect(60, 80)] };
  layer.front = { shapes: [rect(60, 40)] };
  layer.side = { shapes: [rect(80, 40)] };
  return layer;
}

describe("objectSampler", () => {
  const sampler = objectSampler(world, boxLayer());

  it("is empty outside the object footprint", () => {
    expect(sampler(10, 10)).toEqual([]);
    expect(sampler(120, 120)).toEqual([]);
  });

  it("is a full-height interval inside the box", () => {
    const iv = sampler(80, 90); // world point inside the 50..110 × 50..130 box
    expect(iv).toHaveLength(1);
    expect(iv[0]!.lo).toBeCloseTo(0);
    expect(iv[0]!.hi).toBeCloseTo(40);
  });

  it("intersects front and side heights (gable → hip roof)", () => {
    // House template: at the centre column the roof peak reaches ~50mm.
    const house = newObjectLayer("House", world);
    const s = objectSampler(world, house);
    const center = s(house.transform.x + 30, house.transform.z + 40);
    expect(center).toHaveLength(1);
    expect(center[0]!.hi).toBeGreaterThan(45); // near the 50mm peak
    // A corner column is walls-only height (~30mm, below the gable start).
    const corner = s(house.transform.x + 8, house.transform.z + 8);
    expect(corner[0]!.hi).toBeLessThan(35);
  });
});

describe("slicing an object layer needs no engine changes", () => {
  it("produces interlocking pieces for a pure-object doc", () => {
    const doc: Doc = defaultDoc();
    doc.layers = [newObjectLayer("House", world)];
    const model = sliceDoc(doc, new Map());
    expect(model.pieces.length).toBeGreaterThan(6);
    // Every piece is a real closed polygon standing above the base.
    for (const p of model.pieces) {
      expect(p.outline.length).toBeGreaterThanOrEqual(4);
      expect(p.bbox.maxY).toBeGreaterThan(p.bbox.minY);
    }
    // Both slicing families appear.
    expect(new Set(model.pieces.map((p) => p.familyIndex)).size).toBe(2);
  });
});
