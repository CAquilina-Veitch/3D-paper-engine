import { type HeightmapStack, defaultNoiseSublayer, defaultPaintSublayer } from "@paper3d/model";
import { describe, expect, it } from "vitest";
import { blendFn, remapFn } from "../src/field/blend";
import { Compositor } from "../src/field/compositor";
import { makeNoise } from "../src/field/noise";
import { FieldSampler } from "../src/field/sampler";

describe("noise", () => {
  it("is deterministic per seed and in 0..1", () => {
    for (const algo of ["simplex", "perlin", "fbm", "ridged", "voronoi"] as const) {
      const params = { ...defaultNoiseSublayer(7), algo };
      const a = makeNoise(params);
      const b = makeNoise(params);
      for (let i = 0; i < 200; i++) {
        const u = (i * 0.013) % 1;
        const v = (i * 0.029) % 1;
        expect(a(u, v)).toBe(b(u, v));
        expect(a(u, v)).toBeGreaterThanOrEqual(0);
        expect(a(u, v)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("differs across seeds", () => {
    const a = makeNoise(defaultNoiseSublayer(1));
    const b = makeNoise(defaultNoiseSublayer(2));
    expect(a(0.3, 0.7)).not.toBe(b(0.3, 0.7));
  });
});

describe("blend + remap", () => {
  it("applies blend math", () => {
    expect(blendFn("add")(0.5, 0.25)).toBe(0.75);
    expect(blendFn("subtract")(0.5, 0.25)).toBe(0.25);
    expect(blendFn("multiply")(0.5, 0.5)).toBe(0.25);
    expect(blendFn("min")(0.5, 0.25)).toBe(0.25);
    expect(blendFn("max")(0.5, 0.25)).toBe(0.5);
    expect(blendFn("replace")(0.5, 0.25)).toBe(0.25);
  });

  it("applies levels and curves", () => {
    const levels = remapFn({ levels: { inLo: 0, inHi: 1, gamma: 1, outLo: 0, outHi: 2 } });
    expect(levels(0.5)).toBeCloseTo(1);
    const curve = remapFn({
      curve: [
        [0, 1],
        [1, 0],
      ],
    });
    expect(curve(0.25)).toBeCloseTo(0.75);
  });
});

describe("compositor", () => {
  const stack = (resolution = 128): HeightmapStack => ({
    resolution: resolution as 256,
    sublayers: [defaultNoiseSublayer(3), defaultPaintSublayer(resolution)],
  });

  it("dirty-rect recomposite matches a full recomposite", () => {
    const s = stack();
    const full = new Compositor(128);
    full.compositeAll(s);

    const tiled = new Compositor(128);
    tiled.compositeAll(s);
    // Paint into the stack, then recomposite only the touched tiles.
    const paint = s.sublayers[1]!;
    if (paint.kind !== "paint") throw new Error("expected paint");
    for (let y = 40; y < 60; y++) for (let x = 70; x < 90; x++) paint.data[y * 128 + x] = 0.8;
    tiled.compositeDirtyRect(s, 70, 40, 90, 60);
    full.compositeAll(s);

    expect(tiled.field).toEqual(full.field);
  });

  it("clamps the final field to 0..1", () => {
    const s: HeightmapStack = {
      resolution: 256,
      sublayers: [
        { ...defaultNoiseSublayer(1), blend: "add" },
        { ...defaultNoiseSublayer(2), blend: "add" },
        { ...defaultNoiseSublayer(3), blend: "add" },
      ],
    };
    const c = new Compositor(256);
    c.compositeAll(s);
    for (const v of c.field) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("sampler", () => {
  it("interpolates bilinearly between texels", () => {
    const field = new Float32Array([0, 1, 0, 1]); // 2×2
    const s = new FieldSampler(field, 2);
    expect(s.sample(0.5, 0.5)).toBeCloseTo(0.5);
    expect(s.sample(0.25, 0.25)).toBeCloseTo(0);
    expect(s.sample(0.75, 0.25)).toBeCloseTo(1);
  });
});
