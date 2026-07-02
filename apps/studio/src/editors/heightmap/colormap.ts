/** Hypsometric tint: deep green lowlands → tan → brown → white peaks. */
const STOPS: [number, [number, number, number]][] = [
  [0.0, [46, 92, 62]],
  [0.3, [110, 139, 78]],
  [0.55, [190, 168, 110]],
  [0.75, [148, 108, 74]],
  [0.9, [200, 200, 200]],
  [1.0, [255, 255, 255]],
];

export function hypso(v: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [x1, c1] = STOPS[i]!;
    const [x0, c0] = STOPS[i - 1]!;
    if (v <= x1) {
      const t = x1 === x0 ? 0 : (v - x0) / (x1 - x0);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return STOPS[STOPS.length - 1]![1];
}

export function paintFieldToCanvas(
  ctx: CanvasRenderingContext2D,
  field: Float32Array,
  resolution: number,
  mode: "gray" | "hypso",
): void {
  const img = ctx.createImageData(resolution, resolution);
  for (let i = 0; i < field.length; i++) {
    const v = field[i]!;
    let r: number;
    let g: number;
    let b: number;
    if (mode === "gray") {
      r = g = b = v * 255;
    } else {
      [r, g, b] = hypso(v);
    }
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
