import type { SliceResult } from "@paper3d/engine/worker";

export interface BuildStats {
  pieces: number;
  /** Cut pages, excluding the page-1 calibration + assembly map. */
  sheets: number;
  /** Total length to cut (outlines + slot notches + holes), mm. */
  cutLengthMm: number;
  warnings: number;
  /** Rough hand-assembly estimate, minutes. */
  estAssemblyMin: number;
}

function ringPerimeter(ring: [number, number][]): number {
  let p = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    p += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return p;
}

export function buildStats(result: SliceResult | null): BuildStats | null {
  if (!result) return null;
  const { model, layout } = result;
  let cut = 0;
  for (const piece of model.pieces) {
    cut += ringPerimeter(piece.outline);
    for (const hole of piece.holes) cut += ringPerimeter(hole);
  }
  const warnings = model.pieces.reduce((n, p) => n + p.warnings.length, 0) + model.warnings.length;
  return {
    pieces: model.pieces.length,
    sheets: Math.max(0, layout.pageCount - 1),
    cutLengthMm: cut,
    warnings,
    // ~40s per piece to cut out and slot into place, by hand.
    estAssemblyMin: Math.round((model.pieces.length * 40) / 60),
  };
}

export interface MaterialPreset {
  name: string;
  thickness: number;
  kerf: number;
}

/** Common cardstock/paper weights → measured thickness (mm). */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: "Printer paper (80gsm)", thickness: 0.1, kerf: 0.03 },
  { name: "Light card (160gsm)", thickness: 0.18, kerf: 0.04 },
  { name: "Cardstock (250gsm)", thickness: 0.25, kerf: 0.05 },
  { name: "Heavy card (300gsm)", thickness: 0.3, kerf: 0.05 },
  { name: "Thin chipboard (~0.5mm)", thickness: 0.5, kerf: 0.08 },
];
