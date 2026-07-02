/**
 * The unifying solid abstraction: a solid is a function from a world XZ point
 * to the sorted, disjoint list of vertical (y) intervals it occupies there.
 * Heightfields, water layers, layer booleans, and (M3) object layers all
 * implement or compose this — slicing consumes nothing else.
 */
export interface Interval {
  lo: number;
  hi: number;
}

export type ColumnSampler = (x: number, z: number) => Interval[];

const EPS = 1e-9;

export function intervalUnion(a: Interval[], b: Interval[]): Interval[] {
  const all = [...a, ...b].sort((p, q) => p.lo - q.lo);
  const out: Interval[] = [];
  for (const iv of all) {
    const last = out[out.length - 1];
    if (last && iv.lo <= last.hi + EPS) {
      last.hi = Math.max(last.hi, iv.hi);
    } else {
      out.push({ ...iv });
    }
  }
  return out;
}

export function intervalIntersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i]!.lo, b[j]!.lo);
    const hi = Math.min(a[i]!.hi, b[j]!.hi);
    if (hi - lo > EPS) out.push({ lo, hi });
    if (a[i]!.hi < b[j]!.hi) i++;
    else j++;
  }
  return out;
}

export function intervalSubtract(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const iv of a) {
    let pieces: Interval[] = [{ ...iv }];
    for (const cut of b) {
      const next: Interval[] = [];
      for (const p of pieces) {
        if (cut.hi <= p.lo + EPS || cut.lo >= p.hi - EPS) {
          next.push(p);
          continue;
        }
        if (cut.lo > p.lo + EPS) next.push({ lo: p.lo, hi: cut.lo });
        if (cut.hi < p.hi - EPS) next.push({ lo: cut.hi, hi: p.hi });
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  return out;
}
