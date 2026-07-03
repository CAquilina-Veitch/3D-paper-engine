import type { ObjectLayer, Ring2 } from "@paper3d/model";
import { type ColumnSampler, type Interval, intervalIntersect } from "./columns";

/**
 * Object layer → ColumnSampler, purely by profile intersection — no 3D CSG.
 * A world column (x,z) maps into object-local space (accounting for the
 * layer transform), then:
 *   - the top footprint decides whether the column is inside the object;
 *   - the front silhouette gives the y-intervals at that x;
 *   - the side silhouette gives the y-intervals at that z;
 * and the solid at the column is the intersection of the two.
 *
 * Because this returns the same `Interval[]` a heightfield does, the slicing,
 * slot, and layout code needs no changes at all.
 */
export function objectSampler(
  world: { width: number; depth: number },
  layer: ObjectLayer,
): ColumnSampler {
  const { size, transform } = layer;
  const cx = size.width / 2;
  const cz = size.depth / 2;
  const cos = Math.cos((-transform.rotY * Math.PI) / 180);
  const sin = Math.sin((-transform.rotY * Math.PI) / 180);

  return (x, z): Interval[] => {
    // World → object-local (inverse translate, then inverse-rotate about centre).
    const wx = x - transform.x - cx;
    const wz = z - transform.z - cz;
    const lx = wx * cos - wz * sin + cx;
    const lz = wx * sin + wz * cos + cz;

    if (lx < 0 || lx > size.width || lz < 0 || lz > size.depth) return [];
    if (!pointInProfile(layer.top.shapes, lx, lz)) return [];

    const frontY = verticalSpans(layer.front.shapes, lx);
    if (frontY.length === 0) return [];
    const sideY = verticalSpans(layer.side.shapes, lz);
    if (sideY.length === 0) return [];
    return intervalIntersect(frontY, sideY);
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
