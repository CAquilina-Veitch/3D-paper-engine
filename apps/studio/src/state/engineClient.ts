import type { EngineWorkerApi, SliceResult } from "@paper3d/engine/worker";
import * as Comlink from "comlink";
import { create } from "zustand";
import { useDocStore } from "./docStore";
import { useUiStore } from "./uiStore";

interface SliceState {
  result: SliceResult | null;
  busy: boolean;
  error: string | null;
}

export const useSliceStore = create<SliceState>()(() => ({
  result: null,
  busy: false,
  error: null,
}));

const worker = new Worker(new URL("../engineWorker.ts", import.meta.url), { type: "module" });
export const engine = Comlink.wrap<EngineWorkerApi>(worker);

let generation = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

async function runSlice(): Promise<void> {
  const myGen = ++generation;
  useSliceStore.setState({ busy: true });
  try {
    // Focus mode slices the isolated layer as if it were its own document.
    const doc = useDocStore.getState().doc;
    const isolated = doc.layers.find((l) => l.id === useUiStore.getState().isolatedLayerId);
    const result = await engine.slice(isolated ? { ...doc, layers: [isolated] } : doc);
    if (myGen !== generation) return; // stale — a newer edit superseded this run
    useSliceStore.setState({ result, busy: false, error: null });
  } catch (err) {
    if (myGen !== generation) return;
    useSliceStore.setState({ busy: false, error: String(err) });
  }
}

export function requestSlice(debounceMs = 300): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(runSlice, debounceMs);
}

/** Wire slicing to doc changes; call once at startup. */
export function startSliceSync(): void {
  runSlice();
  let prev = useDocStore.getState().doc;
  useDocStore.subscribe((state) => {
    if (state.doc !== prev) {
      prev = state.doc;
      requestSlice();
    }
  });
  // Entering/leaving focus mode changes what gets sliced.
  let prevIsolated = useUiStore.getState().isolatedLayerId;
  useUiStore.subscribe((state) => {
    if (state.isolatedLayerId !== prevIsolated) {
      prevIsolated = state.isolatedLayerId;
      requestSlice();
    }
  });
}
