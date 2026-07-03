import type { LayerTransform } from "@paper3d/model";
import type { Interval } from "./columns";

/**
 * Layer placement transform, shared by heightfield and object samplers.
 * World = offset + centre + R(rotY) · scale · (local − centre), pivoting about
 * the layer's footprint centre. At the identity transform (offset 0, rotY 0,
 * scale 1) world === local, so untransformed layers behave exactly as before.
 */
export function worldToLocalXZ(
  t: LayerTransform,
  cx: number,
  cz: number,
  x: number,
  z: number,
): [number, number] {
  const s = t.scale || 1;
  const rad = (t.rotY * Math.PI) / 180;
  const c = Math.cos(rad);
  const sn = Math.sin(rad);
  const dx = x - t.x - cx;
  const dz = z - t.z - cz;
  return [cx + (dx * c + dz * sn) / s, cz + (-dx * sn + dz * c) / s];
}

/** Map a local y-interval into world y (scale then offset). */
export function localToWorldY(t: LayerTransform, lo: number, hi: number): Interval {
  const s = t.scale || 1;
  const y = t.y || 0;
  return { lo: y + s * lo, hi: y + s * hi };
}
