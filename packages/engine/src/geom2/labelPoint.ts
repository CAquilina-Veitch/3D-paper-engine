import polylabel from "polylabel";
import type { Polygon, Vec2 } from "./types";

/** Pole of inaccessibility — the best interior spot for a piece label. */
export function labelPoint(poly: Polygon): { point: Vec2; clearance: number } {
  const rings = [[...poly.outline, poly.outline[0]!], ...poly.holes.map((h) => [...h, h[0]!])];
  const result = polylabel(rings as number[][][], 0.1) as unknown as {
    0: number;
    1: number;
    distance?: number;
  };
  return {
    point: [result[0], result[1]],
    clearance: result.distance ?? 0,
  };
}
