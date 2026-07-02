import { describe, expect, it } from "vitest";
import { defaultDoc } from "../src/defaults";
import { docFromJson, docToJson } from "../src/schema";
import { decodeField, encodeField } from "../src/serialize";

describe("field encoding", () => {
  it("round-trips within u16 quantization error", () => {
    const data = new Float32Array(64 * 64);
    for (let i = 0; i < data.length; i++) data[i] = (Math.sin(i * 0.37) + 1) / 2;
    const decoded = decodeField(encodeField(data), data.length);
    for (let i = 0; i < data.length; i++) {
      expect(Math.abs(decoded[i]! - data[i]!)).toBeLessThan(1 / 65535 + 1e-7);
    }
  });

  it("clamps out-of-range values", () => {
    const decoded = decodeField(encodeField(new Float32Array([-0.5, 1.5])), 2);
    expect(decoded[0]).toBe(0);
    expect(decoded[1]).toBe(1);
  });
});

describe("doc JSON round-trip", () => {
  it("survives serialize → parse with paint data intact", () => {
    const doc = defaultDoc();
    const layer = doc.layers[0]!;
    if (layer.kind !== "heightfield") throw new Error("expected heightfield");
    const paint = layer.heightmap.sublayers.find((s) => s.kind === "paint");
    if (paint?.kind !== "paint") throw new Error("expected paint sublayer");
    paint.data[1234] = 0.5;

    const restored = docFromJson(JSON.parse(JSON.stringify(docToJson(doc))));
    const restoredLayer = restored.layers[0]!;
    if (restoredLayer.kind !== "heightfield") throw new Error("expected heightfield");
    const restoredPaint = restoredLayer.heightmap.sublayers.find((s) => s.kind === "paint");
    if (restoredPaint?.kind !== "paint") throw new Error("expected paint sublayer");

    expect(restoredPaint.data).toBeInstanceOf(Float32Array);
    expect(restoredPaint.data[1234]).toBeCloseTo(0.5, 4);
    expect(restored.world).toEqual(doc.world);
    expect(restored.layers[0]!.slicing.families).toHaveLength(2);
  });

  it("rejects invalid docs", () => {
    expect(() => docFromJson({ version: 2 })).toThrow();
  });
});
