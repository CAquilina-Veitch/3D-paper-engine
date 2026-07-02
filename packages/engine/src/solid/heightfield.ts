import type { Doc, HeightfieldLayer, SurfaceRef } from "@paper3d/model";
import { FieldSampler } from "../field/sampler";
import type { ColumnSampler, Interval } from "./columns";

/** Composited fields for each heightfield layer, keyed by layer id. */
export type FieldMap = Map<string, Float32Array>;

export interface SolidContext {
  doc: Doc;
  fields: FieldMap;
}

type SurfaceFn = (u: number, v: number) => number;

function surfaceFn(ctx: SolidContext, layer: HeightfieldLayer, ref: SurfaceRef): SurfaceFn {
  switch (ref.type) {
    case "zero":
      return () => 0;
    case "const":
      return () => ref.y;
    case "own": {
      const field = ctx.fields.get(layer.id);
      if (!field) throw new Error(`no composited field for layer ${layer.id}`);
      const sampler = new FieldSampler(field, layer.heightmap.resolution);
      const scale = layer.heightScale;
      return (u, v) => sampler.sample(u, v) * scale;
    }
    case "layer": {
      const other = ctx.doc.layers.find(
        (l): l is HeightfieldLayer => l.id === ref.layerId && l.kind === "heightfield",
      );
      if (!other) throw new Error(`surface ref to unknown layer ${ref.layerId}`);
      return surfaceFn(ctx, other, { type: "own" });
    }
  }
}

/**
 * Heightfield layer → ColumnSampler in world mm.
 * The solid spans [bottom - basePedestal, top] wherever top > bottom;
 * the pedestal is a shared rail below the surface so slots never sever pieces.
 * (x, z) are world mm; the layer's heightmap maps over the full world rect.
 */
export function heightfieldSampler(ctx: SolidContext, layer: HeightfieldLayer): ColumnSampler {
  const bottom = surfaceFn(ctx, layer, layer.bottom);
  const top = surfaceFn(ctx, layer, layer.top);
  const { width, depth } = ctx.doc.world;
  const pedestal = layer.bottom.type === "zero" ? ctx.doc.print.basePedestal : 0;

  return (x, z): Interval[] => {
    if (x < 0 || x > width || z < 0 || z > depth) return [];
    const u = x / width;
    const v = z / depth;
    const b = bottom(u, v);
    const t = top(u, v);
    if (t <= b) return pedestal > 0 ? [{ lo: b - pedestal, hi: b }] : [];
    return [{ lo: b - pedestal, hi: t }];
  };
}
