import { create } from "zustand";

export type EditorTab = "2d" | "3d";
export type PreviewMode = "smooth" | "sliced";
export type MapShading = "gray" | "hypso";

interface UiState {
  tab: EditorTab;
  previewMode: PreviewMode;
  explode: number;
  shading: MapShading;
  selectedLayerId: string | null;
  selectedSublayerId: string | null;
  brushSize: number;
  brushHardness: number;
  brushOpacity: number;
  /** +1 raises terrain, -1 lowers. */
  brushSign: 1 | -1;
  exportOpen: boolean;
  set: (partial: Partial<UiState>) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  tab: "3d",
  previewMode: "sliced",
  explode: 0,
  shading: "hypso",
  selectedLayerId: null,
  selectedSublayerId: null,
  brushSize: 24,
  brushHardness: 0.6,
  brushOpacity: 0.5,
  brushSign: 1,
  exportOpen: false,
  set: (partial) => set(partial),
}));
