/**
 * Document model for 3D Paper Engine.
 * All lengths are millimeters at 1:1 print scale unless noted.
 * Heightmap values are normalized 0..1; a layer's `heightScale` converts to mm.
 */

export type BlendMode = "add" | "subtract" | "multiply" | "min" | "max" | "replace";

export interface Levels {
  inLo: number;
  inHi: number;
  gamma: number;
  outLo: number;
  outHi: number;
}

export interface Remap {
  /** Piecewise-linear curve of [in, out] points, in ascending `in` order. */
  curve?: [number, number][];
  levels?: Levels;
}

export interface SublayerBase {
  id: string;
  name: string;
  enabled: boolean;
  blend: BlendMode;
  /** 0..1 pre-blend multiplier. */
  strength: number;
  remap?: Remap;
}

export type NoiseAlgo = "simplex" | "perlin" | "fbm" | "ridged" | "voronoi";

export interface NoiseSublayer extends SublayerBase {
  kind: "noise";
  algo: NoiseAlgo;
  seed: number;
  /** Cycles across the world's width. */
  frequency: number;
  octaves: number;
  lacunarity: number;
  gain: number;
}

export interface PaintSublayer extends SublayerBase {
  kind: "paint";
  /**
   * Normalized height samples, resolution×resolution, row-major.
   * Serialized as u16 via fflate+base64 (see serialize.ts); kept live as Float32Array.
   */
  data: Float32Array;
}

export interface GradientSublayer extends SublayerBase {
  kind: "gradient";
  shape: "linear" | "radial";
  /** Normalized field coords 0..1 (linear: from→to; radial: center→edge). */
  from: [number, number];
  to: [number, number];
}

export interface ImageSublayer extends SublayerBase {
  kind: "image";
  /** Data URL; decoded to luminance on load. */
  src: string;
  fit: "stretch" | "cover";
  /** Decoded luminance, populated at runtime (not serialized). */
  data?: Float32Array;
}

export type Sublayer = NoiseSublayer | PaintSublayer | GradientSublayer | ImageSublayer;

export type HeightmapResolution = 256 | 512 | 1024;

export interface HeightmapStack {
  resolution: HeightmapResolution;
  /** Bottom → top; composited in order onto a zero field. */
  sublayers: Sublayer[];
}

export type SurfaceRef =
  | { type: "zero" }
  | { type: "const"; y: number }
  | { type: "own" }
  | { type: "layer"; layerId: string };

export type SlotOpening = "top" | "bottom";

export interface SliceFamily {
  id: string;
  /** Slice-plane direction in the XZ plane, degrees CCW from +X (parallel mode). */
  angleDeg: number;
  /** Distance between adjacent planes, mm. */
  spacing: number;
  /** Offset of the family's plane grid from the world origin, mm. */
  phase: number;
  slotOpening: SlotOpening;
  /** Radial mode only (M2). */
  radial?: { count: number; startAngle: number } | { rings: number[] };
}

export interface SlicingStrategy {
  mode: "parallel" | "radial";
  families: SliceFamily[];
  assembly: "interlock" | "stack";
  /** Fraction of the parent layer's spacing to offset this layer's planes (e.g. water = 0.5). */
  phaseFromParent?: number;
}

export type LayerInteraction = "cut" | "merge" | "intersect" | "none";

export interface LayerTransform {
  x: number;
  z: number;
  rotY: number;
}

export interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** How this layer combines with layers below it in the stack. */
  interaction: LayerInteraction;
  slicing: SlicingStrategy;
  transform: LayerTransform;
}

export interface HeightfieldLayer extends LayerBase {
  kind: "heightfield";
  bottom: SurfaceRef;
  top: SurfaceRef;
  heightmap: HeightmapStack;
  /** mm of height at heightmap value 1.0. */
  heightScale: number;
}

/** A closed 2D polygon (first point not repeated), plane-local mm. */
export type Ring2 = [number, number][];

/** The shapes drawn in one orthographic view of an object. */
export interface ObjectProfile {
  shapes: Ring2[];
}

/**
 * Profile-intersection object layer. The solid is the intersection of the
 * three views' extrusions:
 *   (x,y) ∈ front  ∧  (z,y) ∈ side  ∧  (x,z) ∈ top
 * so drawing a footprint + two silhouettes carves a 3D object (the car/cake).
 */
export interface ObjectLayer extends LayerBase {
  kind: "object";
  /** Object bounding box, mm. */
  size: { width: number; height: number; depth: number };
  /** Footprint, coords (x, z). */
  top: ObjectProfile;
  /** Front silhouette, coords (x, y). */
  front: ObjectProfile;
  /** Side silhouette, coords (z, y). */
  side: ObjectProfile;
}

export type ObjectView = "top" | "front" | "side";

export type SmartLayer = HeightfieldLayer | ObjectLayer;

export interface PrintSettings {
  paperThickness: number;
  kerf: number;
  /** Page margin, mm. */
  margin: number;
  /** Space between packed pieces, mm. */
  gutter: number;
  /** Constant rail added below heightfield bottoms so slots never sever pieces, mm. */
  basePedestal: number;
  /** Minimum remaining material beside/below a slot before warning, mm. */
  minWeb: number;
}

export interface Doc {
  version: 1;
  id: string;
  name: string;
  world: { width: number; depth: number };
  print: PrintSettings;
  /** Ordered bottom → top. */
  layers: SmartLayer[];
}

export const slotWidth = (print: PrintSettings): number => print.paperThickness + print.kerf;
