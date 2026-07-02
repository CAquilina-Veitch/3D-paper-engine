import type { SlicePlane } from "./planes";

export interface Crossing {
  a: SlicePlane;
  b: SlicePlane;
  /** Plane-local u of the crossing on each plane. */
  uA: number;
  uB: number;
  /** World XZ of the crossing. */
  point: [number, number];
  /** sin of the angle between the two plane directions (slot widening factor). */
  sinTheta: number;
}

/**
 * All pairwise crossings between planes of *different* families that fall
 * inside both planes' clipped ranges.
 */
export function planeCrossings(planes: SlicePlane[]): Crossing[] {
  const out: Crossing[] = [];
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i]!;
      const b = planes[j]!;
      if (a.familyId === b.familyId) continue;
      const cross = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0];
      if (Math.abs(cross) < 1e-9) continue; // parallel families
      const dx = b.origin[0] - a.origin[0];
      const dz = b.origin[1] - a.origin[1];
      const uA = (dx * b.dir[1] - dz * b.dir[0]) / cross;
      const uB = (dx * a.dir[1] - dz * a.dir[0]) / cross;
      if (uA < a.u0 || uA > a.u1 || uB < b.u0 || uB > b.u1) continue;
      out.push({
        a,
        b,
        uA,
        uB,
        point: [a.origin[0] + uA * a.dir[0], a.origin[1] + uA * a.dir[1]],
        sinTheta: Math.abs(cross),
      });
    }
  }
  return out;
}
