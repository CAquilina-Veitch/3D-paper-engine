import type { NoiseSublayer } from "@paper3d/model";
import Alea from "alea";
import { createNoise2D } from "simplex-noise";

/**
 * Noise evaluators over normalized field coords (u, v in 0..1).
 * All algorithms output 0..1. `frequency` = feature cycles across the field.
 */
export type NoiseFn = (u: number, v: number) => number;

function fbmFactory(
  seed: number,
  frequency: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  transform: (n: number) => number,
  normalizeSigned: boolean,
): NoiseFn {
  const base = createNoise2D(Alea(seed));
  return (u, v) => {
    let amp = 1;
    let freq = frequency;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * transform(base(u * freq + o * 31.7, v * freq + o * 17.3));
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    const n = sum / norm;
    return normalizeSigned ? (n + 1) / 2 : n;
  };
}

/** Worley/cellular noise: distance to nearest of one feature point per grid cell. */
function voronoiFactory(seed: number, frequency: number): NoiseFn {
  const rng = Alea(seed);
  // Deterministic per-cell jitter via hashed seeds; cache points lazily.
  const points = new Map<string, [number, number]>();
  const hashBase = rng() * 1e6;
  const cellPoint = (cx: number, cy: number): [number, number] => {
    const key = `${cx},${cy}`;
    let p = points.get(key);
    if (!p) {
      const h = Alea(hashBase + cx * 374761393 + cy * 668265263);
      p = [cx + h(), cy + h()];
      points.set(key, p);
    }
    return p;
  };
  return (u, v) => {
    const x = u * frequency;
    const y = v * frequency;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best = Number.POSITIVE_INFINITY;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [px, py] = cellPoint(cx + dx, cy + dy);
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < best) best = d;
      }
    }
    // sqrt distance normalized: max possible nearest distance ≈ ~1.0 cell units
    return Math.min(1, Math.sqrt(best));
  };
}

export function makeNoise(params: NoiseSublayer): NoiseFn {
  const { algo, seed, frequency, octaves, lacunarity, gain } = params;
  switch (algo) {
    case "simplex": {
      const n = createNoise2D(Alea(seed));
      return (u, v) => (n(u * frequency, v * frequency) + 1) / 2;
    }
    case "perlin":
      // Visually-equivalent gradient noise; simplex kernel with single octave.
      return fbmFactory(seed, frequency, 1, lacunarity, gain, (n) => n, true);
    case "fbm":
      return fbmFactory(seed, frequency, octaves, lacunarity, gain, (n) => n, true);
    case "ridged":
      return fbmFactory(
        seed,
        frequency,
        octaves,
        lacunarity,
        gain,
        (n) => 1 - 2 * Math.abs(n),
        true,
      );
    case "voronoi":
      return voronoiFactory(seed, frequency);
  }
}
