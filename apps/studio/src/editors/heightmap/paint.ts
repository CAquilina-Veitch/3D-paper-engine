import type { HeightfieldLayer, PaintSublayer } from "@paper3d/model";
import { useDocStore } from "../../state/docStore";
import { recompositeRect } from "../../state/fieldStore";

export interface BrushParams {
  /** Radius in field pixels. */
  size: number;
  /** 0 = fully soft falloff, 1 = hard edge. */
  hardness: number;
  opacity: number;
  sign: 1 | -1;
}

/**
 * One brush stroke. The live Float32Array is mutated in place for zero-latency
 * feedback (doc identity unchanged → no undo churn); commit() then writes the
 * stroke as a single undo step: the pre-stroke values are restored into the
 * original buffer and a cloned "after" buffer replaces it in the doc, so the
 * zundo history snapshot keeps the correct before-state.
 */
export class Stroke {
  private before: Float32Array;
  private last: [number, number] | null = null;
  private dirty: [number, number, number, number] | null = null;

  constructor(
    private layer: HeightfieldLayer,
    private sublayer: PaintSublayer,
    private brush: BrushParams,
  ) {
    this.before = sublayer.data.slice();
  }

  /** Apply the brush along the segment from the previous position. */
  moveTo(x: number, y: number, pressure = 1): void {
    const from = this.last ?? [x, y];
    this.last = [x, y];
    const dist = Math.hypot(x - from[0], y - from[1]);
    const spacing = Math.max(1, this.brush.size / 4);
    const steps = Math.max(1, Math.ceil(dist / spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.dab(from[0] + (x - from[0]) * t, from[1] + (y - from[1]) * t, pressure);
    }
    if (this.dirty) {
      const [x0, y0, x1, y1] = this.dirty;
      recompositeRect(this.layer, x0, y0, x1 + 1, y1 + 1);
      this.dirty = null;
    }
  }

  private dab(cx: number, cy: number, pressure: number): void {
    const res = this.layer.heightmap.resolution;
    const r = this.brush.size;
    const data = this.sublayer.data;
    const alpha = this.brush.opacity * pressure * 0.15 * this.brush.sign;
    const hardEdge = Math.max(0.01, 1 - this.brush.hardness);

    const x0 = Math.max(0, Math.floor(cx - r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const x1 = Math.min(res - 1, Math.ceil(cx + r));
    const y1 = Math.min(res - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d > 1) continue;
        // Smooth falloff starting at (1 - hardEdge).
        const t = Math.min(1, Math.max(0, (1 - d) / hardEdge));
        const fall = t * t * (3 - 2 * t);
        const i = y * res + x;
        data[i] = Math.min(1, Math.max(0, data[i]! + alpha * fall));
      }
    }
    this.dirty = this.dirty
      ? [
          Math.min(this.dirty[0], x0),
          Math.min(this.dirty[1], y0),
          Math.max(this.dirty[2], x1),
          Math.max(this.dirty[3], y1),
        ]
      : [x0, y0, x1, y1];
  }

  /** Finish the stroke as a single undo step. */
  commit(): void {
    const after = this.sublayer.data.slice();
    this.sublayer.data.set(this.before);
    const layerId = this.layer.id;
    const sublayerId = this.sublayer.id;
    useDocStore.getState().update((doc) => {
      const layer = doc.layers.find((l) => l.id === layerId);
      if (layer?.kind !== "heightfield") return;
      const sub = layer.heightmap.sublayers.find((s) => s.id === sublayerId);
      if (sub?.kind === "paint") sub.data = after;
    });
  }
}
