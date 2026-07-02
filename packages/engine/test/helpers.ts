import { type Doc, defaultDoc, defaultNoiseSublayer } from "@paper3d/model";
import { compositeDoc } from "../src/field/compositeDoc";
import type { Vec2 } from "../src/geom2/types";
import type { FieldMap } from "../src/solid/heightfield";

/** Deterministic default doc: noise-only terrain (no timestamps in ids). */
export function testDoc(seed = 1, spacing = 8): { doc: Doc; fields: FieldMap } {
  const doc = defaultDoc();
  doc.id = "doc_test";
  const layer = doc.layers[0]!;
  if (layer.kind !== "heightfield") throw new Error("expected heightfield");
  layer.id = "terrain";
  layer.heightmap.resolution = 256;
  layer.heightmap.sublayers = [{ ...defaultNoiseSublayer(seed), id: "noise" }];
  layer.slicing.families.forEach((f, i) => {
    f.id = `fam${i}`;
    f.spacing = spacing;
    f.phase = spacing / 2;
  });
  return { doc, fields: compositeDoc(doc) };
}

/**
 * Material intervals of a piece polygon along the vertical line x = u
 * (even-odd rule). Used by the assembly simulation.
 */
export function verticalIntervals(outline: Vec2[], holes: Vec2[][], u: number): [number, number][] {
  const ys: number[] = [];
  for (const ring of [outline, ...holes]) {
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i]!;
      const [x1, y1] = ring[(i + 1) % ring.length]!;
      if ((x0 <= u && x1 > u) || (x1 <= u && x0 > u)) {
        ys.push(y0 + ((u - x0) / (x1 - x0)) * (y1 - y0));
      }
    }
  }
  ys.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < ys.length; i += 2) out.push([ys[i]!, ys[i + 1]!]);
  return out;
}
