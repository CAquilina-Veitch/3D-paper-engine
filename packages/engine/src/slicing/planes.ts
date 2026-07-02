import type { SliceFamily, SlicingStrategy } from "@paper3d/model";
import type { ModelWarning } from "./warnings";

export interface SlicePlane {
  id: string;
  layerId: string;
  familyId: string;
  /** 0-based family position (0 → label letter "A"). */
  familyIndex: number;
  /** Plane number within the family, in ascending offset order. */
  index: number;
  /** World XZ point on the plane line. */
  origin: [number, number];
  /** Unit direction of the plane line in XZ. */
  dir: [number, number];
  /** Plane-local u range where the line crosses the world rect. */
  u0: number;
  u1: number;
}

/** Planes shorter than this are not worth printing. */
const MIN_PLANE_LENGTH = 2;

/**
 * Expand a parallel-mode strategy into concrete slice planes clipped to the
 * world rect. A family with angle θ slices along direction (cosθ, sinθ); its
 * planes stack along the normal at `spacing` intervals from `phase`.
 */
export function strategyPlanes(
  layerId: string,
  strategy: SlicingStrategy,
  world: { width: number; depth: number },
  warnings: ModelWarning[],
): SlicePlane[] {
  if (strategy.mode !== "parallel") {
    warnings.push({ type: "empty-layer", layerId, detail: "radial slicing not implemented yet" });
    return [];
  }
  const planes: SlicePlane[] = [];
  strategy.families.forEach((family, familyIndex) => {
    planes.push(...familyPlanes(layerId, family, familyIndex, world, warnings));
  });
  return planes;
}

function familyPlanes(
  layerId: string,
  family: SliceFamily,
  familyIndex: number,
  world: { width: number; depth: number },
  warnings: ModelWarning[],
): SlicePlane[] {
  const theta = (family.angleDeg * Math.PI) / 180;
  const dir: [number, number] = [Math.cos(theta), Math.sin(theta)];
  const normal: [number, number] = [-dir[1], dir[0]];

  // Offset range of the world rect along the family normal.
  const corners: [number, number][] = [
    [0, 0],
    [world.width, 0],
    [0, world.depth],
    [world.width, world.depth],
  ];
  const dots = corners.map(([x, z]) => x * normal[0] + z * normal[1]);
  const minDot = Math.min(...dots);
  const maxDot = Math.max(...dots);

  // Planes coincident with the world boundary produce flimsy degenerate
  // walls whose crossings sit exactly at other pieces' ends — skip them.
  const BOUNDARY_EPS = 1e-6;
  const out: SlicePlane[] = [];
  const kLo = Math.ceil((minDot + BOUNDARY_EPS - family.phase) / family.spacing);
  const kHi = Math.floor((maxDot - BOUNDARY_EPS - family.phase) / family.spacing);
  let index = 0;
  for (let k = kLo; k <= kHi; k++) {
    const offset = family.phase + k * family.spacing;
    const origin: [number, number] = [normal[0] * offset, normal[1] * offset];
    const clip = clipLineToRect(origin, dir, world.width, world.depth);
    if (!clip) continue;
    const [u0, u1] = clip;
    if (u1 - u0 < MIN_PLANE_LENGTH) {
      warnings.push({
        type: "dropped-plane",
        layerId,
        detail: `plane at offset ${offset.toFixed(1)}mm only spans ${(u1 - u0).toFixed(1)}mm — dropped`,
      });
      continue;
    }
    out.push({
      id: `${family.id}_${k}`,
      layerId,
      familyId: family.id,
      familyIndex,
      index: index++,
      origin,
      dir,
      u0,
      u1,
    });
  }
  return out;
}

/** Slab-clip the parametric line origin + u·dir against [0,w]×[0,d]. */
function clipLineToRect(
  origin: [number, number],
  dir: [number, number],
  w: number,
  d: number,
): [number, number] | null {
  let t0 = Number.NEGATIVE_INFINITY;
  let t1 = Number.POSITIVE_INFINITY;
  const axes: [number, number, number][] = [
    [origin[0], dir[0], w],
    [origin[1], dir[1], d],
  ];
  for (const [o, dv, extent] of axes) {
    if (Math.abs(dv) < 1e-12) {
      if (o < 0 || o > extent) return null;
      continue;
    }
    const a = (0 - o) / dv;
    const b = (extent - o) / dv;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  return t0 < t1 ? [t0, t1] : null;
}

export function planePoint(plane: SlicePlane, u: number): [number, number] {
  return [plane.origin[0] + u * plane.dir[0], plane.origin[1] + u * plane.dir[1]];
}
