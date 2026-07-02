import type { HeightmapStack, Sublayer } from "@paper3d/model";
import { blendFn, remapFn } from "./blend";
import { makeNoise } from "./noise";

export const TILE_SIZE = 64;

/**
 * Composites a sublayer stack into a normalized Float32Array heightfield.
 * Supports dirty-tile recompositing so brush strokes only re-run the stack
 * over touched 64×64 tiles. Output is clamped to 0..1 at the end of the stack
 * (intermediate values may exceed the range, matching Photoshop-style stacking).
 */
export class Compositor {
  readonly resolution: number;
  readonly field: Float32Array;

  constructor(resolution: number) {
    this.resolution = resolution;
    this.field = new Float32Array(resolution * resolution);
  }

  /** Recomposite the full field. */
  compositeAll(stack: HeightmapStack): void {
    this.compositeRect(stack, 0, 0, this.resolution, this.resolution);
  }

  /** Recomposite only the given pixel rect (clamped to bounds). */
  compositeRect(stack: HeightmapStack, x0: number, y0: number, x1: number, y1: number): void {
    const res = this.resolution;
    const rx0 = Math.max(0, x0);
    const ry0 = Math.max(0, y0);
    const rx1 = Math.min(res, x1);
    const ry1 = Math.min(res, y1);
    if (rx0 >= rx1 || ry0 >= ry1) return;

    const evals = stack.sublayers
      .filter((s) => s.enabled)
      .map((s) => ({
        blend: blendFn(s.blend),
        remap: remapFn(s.remap),
        strength: s.strength,
        sample: sublayerSampler(s, res),
      }));

    const field = this.field;
    for (let y = ry0; y < ry1; y++) {
      const v = (y + 0.5) / res;
      for (let x = rx0; x < rx1; x++) {
        const u = (x + 0.5) / res;
        let acc = 0;
        for (const e of evals) {
          acc = e.blend(acc, e.remap(e.sample(u, v, x, y)) * e.strength);
        }
        field[y * res + x] = Math.min(1, Math.max(0, acc));
      }
    }
  }

  /** Recomposite the tiles covering the given pixel rect. */
  compositeDirtyRect(stack: HeightmapStack, x0: number, y0: number, x1: number, y1: number): void {
    const tx0 = Math.floor(x0 / TILE_SIZE) * TILE_SIZE;
    const ty0 = Math.floor(y0 / TILE_SIZE) * TILE_SIZE;
    const tx1 = Math.ceil(x1 / TILE_SIZE) * TILE_SIZE;
    const ty1 = Math.ceil(y1 / TILE_SIZE) * TILE_SIZE;
    this.compositeRect(stack, tx0, ty0, tx1, ty1);
  }
}

type SampleFn = (u: number, v: number, x: number, y: number) => number;

function sublayerSampler(s: Sublayer, resolution: number): SampleFn {
  switch (s.kind) {
    case "noise": {
      const n = makeNoise(s);
      return (u, v) => n(u, v);
    }
    case "paint": {
      const data = s.data;
      return (_u, _v, x, y) => data[y * resolution + x] ?? 0;
    }
    case "gradient": {
      const [fx, fy] = s.from;
      const [tx, ty] = s.to;
      if (s.shape === "radial") {
        const r = Math.hypot(tx - fx, ty - fy) || 1;
        return (u, v) => {
          const d = Math.hypot(u - fx, v - fy) / r;
          return Math.max(0, 1 - d);
        };
      }
      const dx = tx - fx;
      const dy = ty - fy;
      const len2 = dx * dx + dy * dy || 1;
      return (u, v) => Math.min(1, Math.max(0, ((u - fx) * dx + (v - fy) * dy) / len2));
    }
    case "image": {
      const data = s.data;
      if (!data) return () => 0;
      // Image data is resampled to the stack resolution at decode time.
      return (_u, _v, x, y) => data[y * resolution + x] ?? 0;
    }
  }
}
