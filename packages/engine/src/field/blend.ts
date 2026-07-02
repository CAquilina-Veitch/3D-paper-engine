import type { BlendMode, Remap } from "@paper3d/model";

export type BlendFn = (base: number, value: number) => number;

export function blendFn(mode: BlendMode): BlendFn {
  switch (mode) {
    case "add":
      return (base, v) => base + v;
    case "subtract":
      return (base, v) => base - v;
    case "multiply":
      return (base, v) => base * v;
    case "min":
      return (base, v) => Math.min(base, v);
    case "max":
      return (base, v) => Math.max(base, v);
    case "replace":
      return (_base, v) => v;
  }
}

/** Build a value remapper from optional levels + curve. Identity when absent. */
export function remapFn(remap: Remap | undefined): (v: number) => number {
  if (!remap || (!remap.levels && !remap.curve?.length)) return (v) => v;
  const { levels, curve } = remap;
  return (v) => {
    let out = v;
    if (levels) {
      const { inLo, inHi, gamma, outLo, outHi } = levels;
      const t = inHi === inLo ? 0 : Math.min(1, Math.max(0, (out - inLo) / (inHi - inLo)));
      out = outLo + (outHi - outLo) * t ** gamma;
    }
    if (curve && curve.length >= 2) {
      out = evalCurve(curve, out);
    }
    return out;
  };
}

function evalCurve(points: [number, number][], x: number): number {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}
