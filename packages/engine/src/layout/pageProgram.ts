import type { Vec2 } from "../geom2/types";

/**
 * Backend-neutral page description in page-space millimeters,
 * origin top-left, y down. Rendered by both svg.ts (preview + golden tests)
 * and pdf.ts (export), so the two outputs can never drift apart.
 */

export type PathStyle = "cut" | "aux" | "faint";

export type PageOp =
  | { kind: "path"; rings: Vec2[][]; style: PathStyle; dashed?: boolean }
  | {
      kind: "text";
      at: Vec2;
      text: string;
      sizePt: number;
      rotateDeg?: number;
      color?: "black" | "gray";
      anchor?: "start" | "middle";
    }
  | { kind: "line"; from: Vec2; to: Vec2; style: PathStyle; dashed?: boolean }
  | { kind: "circle"; at: Vec2; r: number; style: PathStyle; filled?: boolean };

export interface PageOps {
  widthMm: number;
  heightMm: number;
  ops: PageOp[];
}

export interface PageProgram {
  pages: PageOps[];
}

export const A4: { widthMm: number; heightMm: number } = { widthMm: 210, heightMm: 297 };

export const STYLE_WIDTH_PT: Record<PathStyle, number> = {
  cut: 0.4,
  aux: 0.25,
  faint: 0.15,
};
