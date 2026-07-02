/** 2D geometry primitives in plane-local mm. */
export type Vec2 = [number, number];
/** Closed ring; first point is NOT repeated at the end. */
export type Ring = Vec2[];

export interface Polygon {
  /** CCW outer ring. */
  outline: Ring;
  /** CW holes. */
  holes: Ring[];
}

export interface Box2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function ringBox(ring: Ring): Box2 {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function polygonBox(poly: Polygon): Box2 {
  return ringBox(poly.outline);
}

/** Signed area; positive = CCW. */
export function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

export function polygonArea(poly: Polygon): number {
  return (
    Math.abs(ringArea(poly.outline)) - poly.holes.reduce((acc, h) => acc + Math.abs(ringArea(h)), 0)
  );
}
