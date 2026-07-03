import type { Doc, HeightfieldLayer, SurfaceRef } from "@paper3d/model";
import { FieldSampler } from "../field/sampler";
import type { ColumnSampler, Interval } from "./columns";
import { localToWorldY, worldToLocalXZ } from "./transform";

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
  const t = layer.transform;
  const cx = width / 2;
  const cz = depth / 2;

  return (x, z): Interval[] => {
    const [lx, lz] = worldToLocalXZ(t, cx, cz, x, z);
    if (lx < 0 || lx > width || lz < 0 || lz > depth) return [];
    const u = lx / width;
    const v = lz / depth;
    const b = bottom(u, v);
    const surface = top(u, v);
    if (surface <= b) {
      return pedestal > 0 ? [localToWorldY(t, b - pedestal, b)] : [];
    }
    return [localToWorldY(t, b - pedestal, surface)];
  };
}
