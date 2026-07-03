import type { ObjectLayer, Ring2 } from "@paper3d/model";
import { type ColumnSampler, type Interval, intervalIntersect } from "./columns";
import { localToWorldY, worldToLocalXZ } from "./transform";

/**
 * Object solid in the object's own (untransformed) local space: footprint
 * mask ∩ front y-spans ∩ side y-spans. Exposed so the 3D preview can mesh the
 * object without re-deriving the geometry.
 */
export function objectLocalColumns(layer: ObjectLayer, lx: number, lz: number): Interval[] {
  const { size } = layer;
  if (lx < 0 || lx > size.width || lz < 0 || lz > size.depth) return [];
  if (!pointInProfile(layer.top.shapes, lx, lz)) return [];
  const frontY = verticalSpans(layer.front.shapes, lx);
  if (frontY.length === 0) return [];
  const sideY = verticalSpans(layer.side.shapes, lz);
  if (sideY.length === 0) return [];
  return intervalIntersect(frontY, sideY);
}

/**
 * Object layer → ColumnSampler, purely by profile intersection — no 3D CSG.
 * The world column is inverse-transformed into local space, evaluated, and the
 * resulting y-intervals mapped back through the layer's y offset + scale.
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

/** Even-odd point-in-polygon across a profile's shapes. */
function pointInProfile(shapes: Ring2[], px: number, py: number): boolean {
  let inside = false;
  for (const ring of shapes) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * Vertical scan of a profile at horizontal position `h`: the y-intervals the
 * shapes occupy on the line x=h (even-odd), sorted and merged.
 */
function verticalSpans(shapes: Ring2[], h: number): Interval[] {
  const ys: number[] = [];
  for (const ring of shapes) {
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i]!;
      const [x1, y1] = ring[(i + 1) % ring.length]!;
      if ((x0 <= h && x1 > h) || (x1 <= h && x0 > h)) {
        ys.push(y0 + ((h - x0) / (x1 - x0)) * (y1 - y0));
      }
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
