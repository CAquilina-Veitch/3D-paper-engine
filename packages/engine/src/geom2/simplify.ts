import type { Ring, Vec2 } from "./types";

/** Snap to 0.001mm grid — pre-empts most boolean robustness issues. */
export const SNAP = 1e-3;

export function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

export function snapRing(ring: Ring): Ring {
  const out: Ring = [];
  for (const [x, y] of ring) {
    const p: Vec2 = [snap(x), snap(y)];
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  // Drop a duplicated closing point after snapping.
  if (out.length > 1) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (first[0] === last[0] && first[1] === last[1]) out.pop();
  }
  return out;
}

/** Douglas-Peucker on an open polyline. */
export function simplifyPolyline(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    if (i1 - i0 < 2) continue;
    const [ax, ay] = points[i0]!;
    const [bx, by] = points[i1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let maxDist = -1;
    let maxIdx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = points[i]!;
      const dist = Math.abs((px - ax) * dy - (py - ay) * dx) / len;
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }
    if (maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([i0, maxIdx], [maxIdx, i1]);
    }
  }
  const out: Vec2[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]!);
  return out;
}
