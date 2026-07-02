import pc from "polygon-clipping";
import { type Polygon, type Ring, ringArea } from "./types";

/**
 * Thin adapter over polygon-clipping so the boolean backend is swappable
 * (escape hatch: clipper2-wasm with integer µm coords) without touching
 * the slicing code. Coordinates should be pre-snapped (see simplify.ts)
 * to keep the Martinez algorithm numerically happy.
 */

type PcPoly = [number, number][][];

function toPc(polys: Polygon[]): PcPoly[] {
  return polys.map((p) => [closeRing(p.outline), ...p.holes.map(closeRing)]);
}

function closeRing(ring: Ring): [number, number][] {
  if (ring.length === 0) return [];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring as [number, number][];
  return [...ring, first] as [number, number][];
}

function openRing(ring: [number, number][]): Ring {
  if (ring.length < 2) return ring as Ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1) as Ring;
  return ring as Ring;
}

function fromPc(result: PcPoly[]): Polygon[] {
  const out: Polygon[] = [];
  for (const poly of result) {
    if (poly.length === 0) continue;
    const [outer, ...holes] = poly;
    const outline = openRing(outer!);
    if (outline.length < 3) continue;
    out.push({
      outline: ringArea(outline) >= 0 ? outline : outline.slice().reverse(),
      holes: holes
        .map(openRing)
        .filter((h) => h.length >= 3)
        .map((h) => (ringArea(h) <= 0 ? h : h.slice().reverse())),
    });
  }
  return out;
}

export function subtract(subject: Polygon[], clips: Polygon[]): Polygon[] {
  if (subject.length === 0) return [];
  if (clips.length === 0) return subject;
  return fromPc(pc.difference(toPc(subject), toPc(clips)));
}

export function union(a: Polygon[], b: Polygon[]): Polygon[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  return fromPc(pc.union(toPc(a), toPc(b)));
}

export function intersect(a: Polygon[], b: Polygon[]): Polygon[] {
  if (a.length === 0 || b.length === 0) return [];
  return fromPc(pc.intersection(toPc(a), toPc(b)));
}
