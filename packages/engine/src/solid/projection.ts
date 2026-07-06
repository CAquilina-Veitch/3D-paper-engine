import type { ObjectPart, ObjectView, Ring2 } from "@paper3d/model";
import { type Interval, intervalIntersect, intervalUnion } from "./columns";
import { pointInRing, ringVerticalSpans } from "./object";

type Size = { width: number; height: number; depth: number };

/** Samples along the view's horizontal axis when reconstructing a silhouette. */
const H_SAMPLES = 96;
/** Samples along the projection axis when a constraint depends on it. */
const P_SAMPLES = 48;

/**
 * The orthographic silhouette of a part in a view, as polygon rings in that
 * view's (h, v) coordinates. Exact when the part has its own silhouette in
 * the view; otherwise reconstructed by scanning the part's solid along the
 * projection axis — this is what lets a shape drawn in one view show up,
 * truthfully, in the other two.
 */
export function partProjection(part: ObjectPart, size: Size, view: ObjectView): Ring2[] {
  const own = part.profiles[view];
  if (own) return [own];
  const { top, front, side } = part.profiles;
  if (!top && !front && !side) return [];

  const fullH: Interval[] = [{ lo: 0, hi: size.height }];

  if (view === "top") {
    // (h=x, v=z), projecting along y. Occupied where the part has any y-span:
    // z is constrained by the side silhouette's y-spans overlapping front(x).
    return scanColumns(size.width, size.depth, (x) => {
      const yAtX = front ? intervalIntersect(fullH, ringVerticalSpans(front, x)) : fullH;
      if (yAtX.length === 0) return [];
      if (!side) return [{ lo: 0, hi: size.depth }];
      return occupiedRuns(size.depth, (z) => {
        return intervalIntersect(yAtX, ringVerticalSpans(side, z)).length > 0;
      });
    });
  }

  // front: (h=x, v=y), projecting along z — union of side's y-spans over the
  // z the footprint allows at this x. side: symmetric, projecting along x.
  const hExtent = view === "front" ? size.width : size.depth;
  const pExtent = view === "front" ? size.depth : size.width;
  return scanColumns(hExtent, size.height, (h) => {
    const carve = view === "front" ? front : side;
    const other = view === "front" ? side : front;
    if (carve) {
      // Shouldn't happen (own profile returned above), kept for completeness.
      return intervalIntersect(fullH, ringVerticalSpans(carve, h));
    }
    const pAllowed: Interval[] = top
      ? view === "front"
        ? ringVerticalSpans(top, h) // z-spans of the footprint at x=h
        : topHorizontalSpans(top, h, size.width) // x-spans of the footprint at z=h
      : [{ lo: 0, hi: pExtent }];
    if (pAllowed.length === 0) return [];
    if (!other) return pAllowed.length > 0 ? fullH : [];
    // Union the other silhouette's y-spans over sampled positions along p.
    let spans: Interval[] = [];
    for (const run of pAllowed) {
      const n = Math.max(2, Math.ceil(((run.hi - run.lo) / pExtent) * P_SAMPLES));
      for (let i = 0; i <= n; i++) {
        const p = run.lo + ((run.hi - run.lo) * i) / n;
        spans = intervalUnion(spans, ringVerticalSpans(other, p));
      }
    }
    return intervalIntersect(fullH, spans);
  });
}

/** x-spans of the top (x,z) footprint along the horizontal line z=h. */
function topHorizontalSpans(top: Ring2, z: number, _width: number): Interval[] {
  const flipped: Ring2 = top.map(([x, zz]) => [zz, x]);
  return ringVerticalSpans(flipped, z);
}

/** Boolean column scan → merged v-intervals of the occupied runs. */
function occupiedRuns(extent: number, occupied: (v: number) => boolean): Interval[] {
  const out: Interval[] = [];
  const step = extent / P_SAMPLES;
  let runStart: number | null = null;
  for (let i = 0; i <= P_SAMPLES; i++) {
    const v = i * step;
    if (occupied(v)) {
      if (runStart == null) runStart = v;
    } else if (runStart != null) {
      out.push({ lo: runStart, hi: v });
      runStart = null;
    }
  }
  if (runStart != null) out.push({ lo: runStart, hi: extent });
  return out;
}

/**
 * Build silhouette rings from per-column v-spans: contiguous runs of
 * non-empty columns become polygons walking the upper boundary left→right
 * and the lower boundary back. Columns with multiple spans are hulled
 * (min lo → max hi) — a slight over-cover for concave-in-v parts, fine for a
 * projection ghost.
 */
function scanColumns(
  hExtent: number,
  _vExtent: number,
  spansAt: (h: number) => Interval[],
): Ring2[] {
  const cols: { h: number; lo: number; hi: number }[] = [];
  const rings: Ring2[] = [];
  const step = hExtent / H_SAMPLES;

  const flush = () => {
    if (cols.length >= 2) {
      const ring: Ring2 = [
        ...cols.map(({ h, hi }) => [h, hi] as [number, number]),
        ...cols
          .slice()
          .reverse()
          .map(({ h, lo }) => [h, lo] as [number, number]),
      ];
      rings.push(ring);
    }
    cols.length = 0;
  };

  for (let i = 0; i <= H_SAMPLES; i++) {
    const h = i * step;
    const spans = spansAt(h);
    if (spans.length === 0) {
      flush();
      continue;
    }
    cols.push({ h, lo: spans[0]!.lo, hi: spans[spans.length - 1]!.hi });
  }
  flush();
  return rings;
}
