import { type Doc, defaultDoc } from "@paper3d/model";
import { produce, setAutoFreeze } from "immer";
import { temporal } from "zundo";
import { create } from "zustand";

// Object.freeze throws on typed arrays with elements (paint sublayers),
// and the brush mutates live buffers between commits anyway.
setAutoFreeze(false);

interface DocState {
  doc: Doc;
  setDoc: (doc: Doc) => void;
  /** Immer-style update; every call is an undo step. */
  update: (fn: (doc: Doc) => void) => void;
}

/**
 * The document store. Undo/redo via zundo snapshots — paint strokes commit a
 * cloned Float32Array once per stroke (see paint.ts), so history entries share
 * buffers and stay cheap; history is capped to bound memory anyway.
 */
export const useDocStore = create<DocState>()(
  temporal(
    (set) => ({
      doc: defaultDoc(),
      setDoc: (doc) => set({ doc }),
      update: (fn) => set((state) => ({ doc: produce(state.doc, fn) })),
    }),
    { limit: 50 },
  ),
);

export const undo = () => useDocStore.temporal.getState().undo();
export const redo = () => useDocStore.temporal.getState().redo();
