import { simplifyPolyline, snapRing } from "../geom2/simplify";
import { type Polygon, type Vec2, ringArea } from "../geom2/types";
import type { ColumnSampler, Interval } from "../solid/columns";
import { type SlicePlane, planePoint } from "./planes";

/** March step along the plane, mm. */
const STEP = 0.4;
/** Douglas-Peucker tolerance, mm. */
const DP_TOLERANCE = 0.15;
/** Two intervals in adjacent columns join if they overlap this much. */
const JOIN_EPS = 1e-6;

interface Region {
  top: Vec2[];
  bottom: Vec2[];
  last: Interval;
}

/**
 * Extract the closed profile polygon(s) of a solid on a slice plane by
 * marching columns along the plane line. Coordinates are plane-local:
 * u along the plane direction, v = world y.
 *
 * Regions (disjoint material runs) are tracked by interval overlap between
 * adjacent columns; splits and merges close the affected regions and open
 * fresh ones, which bounds any topology error to a single march step.
 */
export function planeProfile(plane: SlicePlane, sampler: ColumnSampler): Polygon[] {
  const length = plane.u1 - plane.u0;
  const count = Math.max(2, Math.ceil(length / STEP) + 1);
  const step = length / (count - 1);

  const closed: Polygon[] = [];
  let active: Region[] = [];

  const close = (region: Region) => {
    const poly = regionToPolygon(region);
    if (poly) closed.push(poly);
  };

  for (let i = 0; i < count; i++) {
    const u = plane.u0 + i * step;
    const [x, z] = planePoint(plane, u);
    const intervals = sampler(x, z);

    const next: Region[] = [];
    const matchedRegions = new Set<Region>();

    for (const iv of intervals) {
      const overlapping = active.filter(
        (r) => r.last.hi > iv.lo + JOIN_EPS && iv.hi > r.last.lo + JOIN_EPS,
      );
      if (overlapping.length === 1) {
        const region = overlapping[0]!;
        if (matchedRegions.has(region)) {
          // A previous interval already continued this region (split):
          // start a fresh region for this interval.
          next.push(newRegion(u, iv));
        } else {
          matchedRegions.add(region);
          region.top.push([u, iv.hi]);
          region.bottom.push([u, iv.lo]);
          region.last = iv;
          next.push(region);
        }
      } else if (overlapping.length === 0) {
        next.push(newRegion(u, iv));
      } else {
        // Merge: several regions meet this interval. Close them, start fresh.
        for (const r of overlapping) {
          if (!matchedRegions.has(r)) {
            matchedRegions.add(r);
            close(r);
          }
        }
        next.push(newRegion(u, iv));
      }
    }

    for (const r of active) if (!matchedRegions.has(r) && !next.includes(r)) close(r);
    active = next;
  }

  for (const r of active) close(r);
  return closed;
}

function newRegion(u: number, iv: Interval): Region {
  return { top: [[u, iv.hi]], bottom: [[u, iv.lo]], last: iv };
}

function regionToPolygon(region: Region): Polygon | null {
  if (region.top.length < 2) return null;
  const top = simplifyPolyline(region.top, DP_TOLERANCE);
  const bottom = simplifyPolyline(region.bottom, DP_TOLERANCE);
  // bottom left→right, then top right→left = CCW ring (v up).
  const ring = snapRing([...bottom, ...top.slice().reverse()]);
  if (ring.length < 3) return null;
  const outline = ringArea(ring) >= 0 ? ring : ring.slice().reverse();
  return { outline, holes: [] };
}
