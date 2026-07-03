import type { Doc, SmartLayer } from "@paper3d/model";
import { type ColumnSampler, intervalIntersect, intervalSubtract } from "./columns";
import { type SolidContext, heightfieldSampler } from "./heightfield";
import { objectSampler } from "./object";

function baseSampler(ctx: SolidContext, layer: SmartLayer): ColumnSampler {
  if (layer.kind === "heightfield") return heightfieldSampler(ctx, layer);
  return objectSampler(ctx.doc.world, layer);
}

/**
 * The effective solid for one layer, accounting for the layers above it in
 * the stack: by default a higher layer with interaction "cut" removes its
 * volume from every layer below (so overlapping regions aren't doubled up in
 * paper), and "intersect" layers clip themselves to the layers below.
 */
export function effectiveSampler(ctx: SolidContext, layer: SmartLayer): ColumnSampler {
  const { doc } = ctx;
  const index = doc.layers.findIndex((l) => l.id === layer.id);
  const own = baseSampler(ctx, layer);

  const cutters = doc.layers
    .slice(index + 1)
    .filter((l) => l.visible && l.interaction === "cut")
    .map((l) => baseSampler(ctx, l));

  const clipTargets =
    layer.interaction === "intersect"
      ? doc.layers
          .slice(0, index)
          .filter((l) => l.visible)
          .map((l) => baseSampler(ctx, l))
      : [];

  if (cutters.length === 0 && clipTargets.length === 0) return own;

  return (x, z) => {
    let intervals = own(x, z);
    for (const clip of clipTargets) intervals = intervalIntersect(intervals, clip(x, z));
    for (const cut of cutters) intervals = intervalSubtract(intervals, cut(x, z));
    return intervals;
  };
}

/** Samplers for every visible layer, keyed by layer id. */
export function sceneSamplers(ctx: SolidContext): Map<string, ColumnSampler> {
  const out = new Map<string, ColumnSampler>();
  for (const layer of ctx.doc.layers) {
    if (!layer.visible) continue;
    out.set(layer.id, effectiveSampler(ctx, layer));
  }
  return out;
}
