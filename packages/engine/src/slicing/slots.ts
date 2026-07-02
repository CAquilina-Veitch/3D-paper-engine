import type { PrintSettings, SlotOpening } from "@paper3d/model";
import { slotWidth } from "@paper3d/model";
import { subtract } from "../geom2/boolean2d";
import { snap } from "../geom2/simplify";
import type { Polygon } from "../geom2/types";
import type { ColumnSampler } from "../solid/columns";
import type { Crossing } from "./crossings";
import type { PieceWarning } from "./warnings";

export interface SlotSpec {
  /** Plane-local u center. */
  u: number;
  width: number;
  opening: SlotOpening;
  /** y of the midline where the two pieces meet. */
  vMid: number;
  /** The plane this slot mates with, and the u position on it. */
  mate: { planeId: string; u: number };
  warnings: PieceWarning[];
}

/** Slots shallower than this many paper thicknesses are useless — skip them. */
const MIN_SLOT_DEPTH_FACTOR = 4;

/**
 * Compute the slot pair for one crossing. Both pieces sample the same solid
 * column, so their shared vertical extent [lo, hi] is identical by
 * construction; each piece keeps its material on its side of the midline.
 * Returns null when the crossing misses the solid entirely.
 */
export function crossingSlots(
  crossing: Crossing,
  sampler: ColumnSampler,
  print: PrintSettings,
  openingFor: (familyId: string) => SlotOpening,
): { a: SlotSpec; b: SlotSpec } | null {
  const intervals = sampler(crossing.point[0], crossing.point[1]);
  if (intervals.length === 0) return null;

  let iv = intervals[0]!;
  for (const candidate of intervals) {
    if (candidate.hi - candidate.lo > iv.hi - iv.lo) iv = candidate;
  }
  const extent = iv.hi - iv.lo;
  const warnings: PieceWarning[] = [];

  if (extent < MIN_SLOT_DEPTH_FACTOR * print.paperThickness) {
    return null; // too shallow to hold anything
  }
  if (intervals.length > 1) {
    warnings.push({
      type: "glue-joint",
      detail:
        "crossing column has multiple material runs; slot placed on the largest — glue the rest",
    });
  }
  if (extent / 2 < print.minWeb) {
    warnings.push({
      type: "shallow-crossing",
      detail: `only ${(extent / 2).toFixed(1)}mm of material remains beside this slot`,
    });
  }

  const openingA = openingFor(crossing.a.familyId);
  const openingB = openingFor(crossing.b.familyId);
  if (openingA === openingB) {
    warnings.push({
      type: "same-opening",
      detail: "both families open the same way — these pieces cannot interlock",
    });
  }

  const vMid = snap((iv.lo + iv.hi) / 2);
  const width = snap(slotWidth(print) / crossing.sinTheta);

  const make = (u: number, opening: SlotOpening, mate: Crossing["a"], mateU: number): SlotSpec => {
    const slotWarnings = [...warnings];
    return {
      u: snap(u),
      width,
      opening,
      vMid,
      mate: { planeId: mate.id, u: snap(mateU) },
      warnings: slotWarnings,
    };
  };

  return {
    a: make(crossing.uA, openingA, crossing.b, crossing.uB),
    b: make(crossing.uB, openingB, crossing.a, crossing.uA),
  };
}

/** Rect polygon for a slot, tall enough to cut through any profile. */
export function slotRect(slot: SlotSpec, vMin: number, vMax: number): Polygon {
  const x0 = slot.u - slot.width / 2;
  const x1 = slot.u + slot.width / 2;
  const [y0, y1] = slot.opening === "top" ? [slot.vMid, vMax + 10] : [vMin - 10, slot.vMid];
  return {
    outline: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    holes: [],
  };
}

/**
 * Subtract all slots from a plane's profile polygons.
 * Returns the resulting islands plus whether subtraction increased the island
 * count beyond what the slots legitimately explain (a severed piece).
 */
export function applySlots(
  profile: Polygon[],
  slots: SlotSpec[],
  vMin: number,
  vMax: number,
): { islands: Polygon[]; severed: boolean } {
  if (slots.length === 0) return { islands: profile, severed: false };
  const rects = slots.map((s) => slotRect(s, vMin, vMax));
  const islands = subtract(profile, rects);
  return { islands, severed: islands.length > profile.length };
}
