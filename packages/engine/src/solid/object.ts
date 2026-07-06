import type { ObjectLayer, ObjectPart, Ring2 } from "@paper3d/model";
import {
  type ColumnSampler,
  type Interval,
  intervalIntersect,
  intervalSubtract,
  intervalUnion,
} from "./columns";
import { localToWorldY, worldToLocalXZ } from "./transform";

/**
 * Object solid in the object's own (untransformed) local space:
 * union of the add-parts minus the subtract-parts. Overlapping parts merge
 * into one solid — there is no even-odd cancellation. Exposed so the 3D
 * preview can mesh the object without re-deriving the geometry.
 */
export function objectLocalColumns(layer: ObjectLayer, lx: number, lz: number): Interval[] {
  const { size } = layer;
  if (lx < 0 || lx > size.width || lz < 0 || lz > size.depth) return [];
  let solid: Interval[] = [];
  for (const part of layer.parts) {
    if (part.mode !== "add") continue;
    solid = intervalUnion(solid, partColumns(part, size, lx, lz));
  }
  if (solid.length === 0) return solid;
  for (const part of layer.parts) {
    if (part.mode !== "subtract") continue;
    solid = intervalSubtract(solid, partColumns(part, size, lx, lz));
  }
  return solid;
}

/**
 * One part's y-intervals at a local footprint point: the intersection of the
 * extrusions of whichever per-view silhouettes the part has. A missing view
 * leaves that axis unconstrained within the object box.
 */
export function partColumns(
  part: ObjectPart,
  size: { width: number; height: number; depth: number },
  lx: number,
  lz: number,
): Interval[] {
  const { top, front, side } = part.profiles;
  if (!top && !front && !side) return [];
  if (top && !pointInRing(top, lx, lz)) return [];
  let spans: Interval[] = [{ lo: 0, hi: size.height }];
  if (front) spans = intervalIntersect(spans, ringVerticalSpans(front, lx));
  if (side) spans = intervalIntersect(spans, ringVerticalSpans(side, lz));
  return spans;
}

/**
 * Object layer → ColumnSampler, purely by per-part profile intersection and
 * cross-part union — no 3D CSG. The world column is inverse-transformed into
 * local space, evaluated, and the resulting y-intervals mapped back through
 * the layer's y offset + scale.
 *
 * Because this returns the same `Interval[]` a heightfield does, the slicing,
 * slot, and layout code needs no changes at all.
 */
export function objectSampler(
  _world: { width: number; depth: number },
  layer: ObjectLayer,
): ColumnSampler {
  const { size, transform } = layer;
  const cx = size.width / 2;
  const cz = size.depth / 2;

  return (x, z): Interval[] => {
    const [lx, lz] = worldToLocalXZ(transform, cx, cz, x, z);
    return objectLocalColumns(layer, lx, lz).map((iv) => localToWorldY(transform, iv.lo, iv.hi));
  };
}

/** Point-in-polygon test for a single ring (even-odd on one ring = containment). */
export function pointInRing(ring: Ring2, px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Vertical scan of one ring at horizontal position `h`: the y-intervals the
 * ring occupies on the line x=h, sorted and merged.
 */
export function ringVerticalSpans(ring: Ring2, h: number): Interval[] {
  const ys: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    if ((x0 <= h && x1 > h) || (x1 <= h && x0 > h)) {
      ys.push(y0 + ((h - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  ys.sort((a, b) => a - b);
  const out: Interval[] = [];
  for (let i = 0; i + 1 < ys.length; i += 2) {
    const lo = ys[i]!;
    const hi = ys[i + 1]!;
    if (hi > lo) out.push({ lo, hi });
  }
  return out;
}
