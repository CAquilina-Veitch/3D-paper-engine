import { create } from "zustand";

export type TransformTool = "move" | "rotate" | "scale";
/** The 3D scene is a sibling view alongside the cross-section workspaces. */
export type Workspace = "scene" | "sculpt" | "slice" | "print";
/** Inside the 3D scene view: show layers solid or cross-sectioned. */
export type SceneAppearance = "solid" | "section";
export type PreviewMode = "smooth" | "sliced";
export type MapShading = "gray" | "hypso";
export type ObjectTool = "select" | "rect" | "circle" | "polygon";

interface UiState {
  transformTool: TransformTool;
  sceneAppearance: SceneAppearance;
  workspace: Workspace;
  previewMode: PreviewMode;
  objectTool: ObjectTool;
  explode: number;
  shading: MapShading;
  selectedLayerId: string | null;
  selectedSublayerId: string | null;
  /** Focus mode: when set, the app edits this layer in isolation (Photoshop-style "open" layer). */
  isolatedLayerId: string | null;
  brushSize: number;
  brushHardness: number;
  brushOpacity: number;
  /** +1 raises terrain, -1 lowers. */
  brushSign: 1 | -1;
  exportOpen: boolean;
  set: (partial: Partial<UiState>) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  transformTool: "move",
  sceneAppearance: "solid",
  workspace: "sculpt",
  previewMode: "sliced",
  objectTool: "select",
  explode: 0,
  shading: "hypso",
  selectedLayerId: null,
  selectedSublayerId: null,
  isolatedLayerId: null,
  brushSize: 24,
  brushHardness: 0.6,
  brushOpacity: 0.5,
  brushSign: 1,
  exportOpen: false,
  set: (partial) => set(partial),
}));
