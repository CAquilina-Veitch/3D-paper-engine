import type {
  Doc,
  HeightfieldLayer,
  NoiseSublayer,
  ObjectLayer,
  PaintSublayer,
  PrintSettings,
  Ring2,
  SlicingStrategy,
} from "./doc";

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export const defaultPrintSettings = (): PrintSettings => ({
  paperThickness: 0.25,
  kerf: 0.05,
  margin: 10,
  gutter: 4,
  basePedestal: 10,
  minWeb: 2,
});

/** The classic egg-crate: two families perpendicular to Y, 90° apart. */
/** Half-spacing phase keeps planes interior — no degenerate slices on the world edge. */
export const eggCrateStrategy = (spacing = 8): SlicingStrategy => ({
  mode: "parallel",
  assembly: "interlock",
  families: [
    { id: newId("fam"), angleDeg: 0, spacing, phase: spacing / 2, slotOpening: "top" },
    { id: newId("fam"), angleDeg: 90, spacing, phase: spacing / 2, slotOpening: "bottom" },
  ],
});

export const diamondStrategy = (spacing = 8, angle = 60): SlicingStrategy => ({
  mode: "parallel",
  assembly: "interlock",
  families: [
    { id: newId("fam"), angleDeg: 0, spacing, phase: spacing / 2, slotOpening: "top" },
    { id: newId("fam"), angleDeg: angle, spacing, phase: spacing / 2, slotOpening: "bottom" },
  ],
});

export const contourStackStrategy = (spacing = 3): SlicingStrategy => ({
  mode: "parallel",
  assembly: "stack",
  families: [{ id: newId("fam"), angleDeg: 0, spacing, phase: 0, slotOpening: "top" }],
});

export function defaultNoiseSublayer(seed = 1): NoiseSublayer {
  return {
    id: newId("sub"),
    name: "Noise",
    enabled: true,
    kind: "noise",
    blend: "add",
    strength: 1,
    algo: "fbm",
    seed,
    frequency: 3,
    octaves: 4,
    lacunarity: 2,
    gain: 0.5,
  };
}

export function defaultPaintSublayer(resolution: number): PaintSublayer {
  return {
    id: newId("sub"),
    name: "Paint",
    enabled: true,
    kind: "paint",
    blend: "add",
    strength: 1,
    data: new Float32Array(resolution * resolution),
  };
}

export function defaultTerrainLayer(): HeightfieldLayer {
  const resolution = 512;
  return {
    id: newId("layer"),
    name: "Terrain",
    kind: "heightfield",
    visible: true,
    locked: false,
    interaction: "merge",
    transform: { x: 0, y: 0, z: 0, rotY: 0, scale: 1 },
    bottom: { type: "zero" },
    top: { type: "own" },
    heightScale: 50,
    heightmap: {
      resolution,
      sublayers: [defaultNoiseSublayer(1), defaultPaintSublayer(resolution)],
    },
    slicing: eggCrateStrategy(8),
  };
}

/** A fresh heightfield smart layer to stack on an existing scene. */
export function newHeightfieldLayer(name: string, seed = 2): HeightfieldLayer {
  const layer = defaultTerrainLayer();
  layer.name = name;
  const noise = layer.heightmap.sublayers.find((s) => s.kind === "noise");
  if (noise?.kind === "noise") noise.seed = seed;
  return layer;
}

/**
 * A fresh object layer, pre-loaded with a little house so the three-view
 * intersection is legible immediately: a rectangular footprint, and a
 * walls-plus-gable silhouette in both front and side. Intersecting the two
 * gables yields a hip roof.
 */
export function newObjectLayer(name: string, world: { width: number; depth: number }): ObjectLayer {
  const size = { width: 60, height: 50, depth: 80 };
  const silhouette = (span: number): Ring2 => [
    [4, 0],
    [span - 4, 0],
    [span - 4, 30],
    [span / 2, 50],
    [4, 30],
  ];
  return {
    id: newId("layer"),
    name,
    kind: "object",
    visible: true,
    locked: false,
    interaction: "merge",
    transform: {
      x: Math.max(0, (world.width - size.width) / 2),
      y: 0,
      z: Math.max(0, (world.depth - size.depth) / 2),
      rotY: 0,
      scale: 1,
    },
    size,
    top: {
      shapes: [
        [
          [4, 4],
          [size.width - 4, 4],
          [size.width - 4, size.depth - 4],
          [4, size.depth - 4],
        ],
      ],
    },
    front: { shapes: [silhouette(size.width)] },
    side: { shapes: [silhouette(size.depth)] },
    slicing: eggCrateStrategy(8),
  };
}

export function defaultDoc(): Doc {
  return {
    version: 1,
    id: newId("doc"),
    name: "Untitled terrain",
    world: { width: 160, depth: 160 },
    print: defaultPrintSettings(),
    layers: [defaultTerrainLayer()],
  };
}
