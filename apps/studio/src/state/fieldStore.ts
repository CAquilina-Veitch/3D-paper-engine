import { Compositor } from "@paper3d/engine";
import type { Doc, HeightfieldLayer } from "@paper3d/model";
import { create } from "zustand";
import { useDocStore } from "./docStore";

interface FieldState {
  /** Live composited field per heightfield layer. Mutated in place; `version` signals changes. */
  compositors: Map<string, Compositor>;
  version: number;
  bump: () => void;
}

/**
 * Main-thread compositor hub: keeps the composited heightmaps hot for the 2D
 * canvas and the smooth 3D mesh. Full recomposite on doc changes; the brush
 * path calls `recompositeRect` directly for live dirty-tile updates.
 */
export const useFieldStore = create<FieldState>()((set) => ({
  compositors: new Map(),
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function getCompositor(layer: HeightfieldLayer): Compositor {
  const { compositors } = useFieldStore.getState();
  let c = compositors.get(layer.id);
  if (!c || c.resolution !== layer.heightmap.resolution) {
    c = new Compositor(layer.heightmap.resolution);
    compositors.set(layer.id, c);
  }
  return c;
}

function recompositeAll(doc: Doc): void {
  for (const layer of doc.layers) {
    if (layer.kind !== "heightfield") continue;
    getCompositor(layer).compositeAll(layer.heightmap);
  }
  useFieldStore.getState().bump();
}

export function recompositeRect(
  layer: HeightfieldLayer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  getCompositor(layer).compositeDirtyRect(layer.heightmap, x0, y0, x1, y1);
  useFieldStore.getState().bump();
}

/** Wire the hub to the doc store; call once at startup. */
export function startFieldSync(): void {
  recompositeAll(useDocStore.getState().doc);
  let prev = useDocStore.getState().doc;
  useDocStore.subscribe((state) => {
    if (state.doc !== prev) {
      prev = state.doc;
      recompositeAll(state.doc);
    }
  });
}
