/**
 * Bilinear sampling of a normalized heightfield.
 * Field coords are (u, v) in 0..1 mapping to the world rect; samples are
 * texel-centered, edge-clamped.
 */
export class FieldSampler {
  constructor(
    readonly field: Float32Array,
    readonly resolution: number,
  ) {}

  sample(u: number, v: number): number {
    const res = this.resolution;
    const fx = Math.min(res - 1, Math.max(0, u * res - 0.5));
    const fy = Math.min(res - 1, Math.max(0, v * res - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(res - 1, x0 + 1);
    const y1 = Math.min(res - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const f = this.field;
    const a = f[y0 * res + x0]!;
    const b = f[y0 * res + x1]!;
    const c = f[y1 * res + x0]!;
    const d = f[y1 * res + x1]!;
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }

  /** Sample `count` points evenly from (u0,v0) to (u1,v1) inclusive. */
  sampleAlongLine(u0: number, v0: number, u1: number, v1: number, count: number): Float32Array {
    const out = new Float32Array(count);
    const step = count > 1 ? 1 / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
      const t = i * step;
      out[i] = this.sample(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
    }
    return out;
  }
}
