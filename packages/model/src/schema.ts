import { z } from "zod";
import type { Doc, Sublayer } from "./doc";
import { decodeField, encodeField } from "./serialize";

const remapSchema = z
  .object({
    curve: z.array(z.tuple([z.number(), z.number()])).optional(),
    levels: z
      .object({
        inLo: z.number(),
        inHi: z.number(),
        gamma: z.number().positive(),
        outLo: z.number(),
        outHi: z.number(),
      })
      .optional(),
  })
  .optional();

const sublayerBase = {
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  blend: z.enum(["add", "subtract", "multiply", "min", "max", "replace"]),
  strength: z.number().min(0).max(1),
  remap: remapSchema,
};

const sublayerSchema = z.discriminatedUnion("kind", [
  z.object({
    ...sublayerBase,
    kind: z.literal("noise"),
    algo: z.enum(["simplex", "perlin", "fbm", "ridged", "voronoi"]),
    seed: z.number(),
    frequency: z.number().positive(),
    octaves: z.number().int().min(1).max(12),
    lacunarity: z.number().positive(),
    gain: z.number().positive(),
  }),
  z.object({
    ...sublayerBase,
    kind: z.literal("paint"),
    /** JSON carries the encoded string; hydrated to Float32Array below. */
    data: z.string(),
  }),
  z.object({
    ...sublayerBase,
    kind: z.literal("gradient"),
    shape: z.enum(["linear", "radial"]),
    from: z.tuple([z.number(), z.number()]),
    to: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    ...sublayerBase,
    kind: z.literal("image"),
    src: z.string(),
    fit: z.enum(["stretch", "cover"]),
  }),
]);

const surfaceRefSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("zero") }),
  z.object({ type: z.literal("const"), y: z.number() }),
  z.object({ type: z.literal("own") }),
  z.object({ type: z.literal("layer"), layerId: z.string() }),
]);

const sliceFamilySchema = z.object({
  id: z.string(),
  angleDeg: z.number(),
  spacing: z.number().positive(),
  phase: z.number(),
  slotOpening: z.enum(["top", "bottom"]),
  radial: z
    .union([
      z.object({ count: z.number().int().positive(), startAngle: z.number() }),
      z.object({ rings: z.array(z.number().positive()) }),
    ])
    .optional(),
});

const slicingSchema = z.object({
  mode: z.enum(["parallel", "radial"]),
  families: z.array(sliceFamilySchema).min(1),
  assembly: z.enum(["interlock", "stack"]),
  phaseFromParent: z.number().optional(),
});

const layerBase = {
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  interaction: z.enum(["cut", "merge", "intersect", "none"]),
  slicing: slicingSchema,
  transform: z.object({ x: z.number(), z: z.number(), rotY: z.number() }),
};

const ring2Schema = z.array(z.tuple([z.number(), z.number()]));
const objectProfileSchema = z.object({ shapes: z.array(ring2Schema) });

const layerSchema = z.discriminatedUnion("kind", [
  z.object({
    ...layerBase,
    kind: z.literal("heightfield"),
    bottom: surfaceRefSchema,
    top: surfaceRefSchema,
    heightmap: z.object({
      resolution: z.union([z.literal(256), z.literal(512), z.literal(1024)]),
      sublayers: z.array(sublayerSchema),
    }),
    heightScale: z.number().positive(),
  }),
  z.object({
    ...layerBase,
    kind: z.literal("object"),
    size: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      depth: z.number().positive(),
    }),
    top: objectProfileSchema,
    front: objectProfileSchema,
    side: objectProfileSchema,
  }),
]);

export const docJsonSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  name: z.string(),
  world: z.object({ width: z.number().positive(), depth: z.number().positive() }),
  print: z.object({
    paperThickness: z.number().positive(),
    kerf: z.number().min(0),
    margin: z.number().min(0),
    gutter: z.number().min(0),
    basePedestal: z.number().min(0),
    minWeb: z.number().min(0),
  }),
  layers: z.array(layerSchema),
});

export type DocJson = z.infer<typeof docJsonSchema>;

/** Serialize a live Doc (Float32Array paint data) to plain JSON. */
export function docToJson(doc: Doc): DocJson {
  return {
    ...doc,
    layers: doc.layers.map((layer) => {
      if (layer.kind !== "heightfield") return layer;
      return {
        ...layer,
        heightmap: {
          ...layer.heightmap,
          sublayers: layer.heightmap.sublayers.map((s) => {
            if (s.kind === "paint") return { ...s, data: encodeField(s.data) };
            if (s.kind === "image") {
              const { data: _runtime, ...rest } = s;
              return rest;
            }
            return s;
          }),
        },
      };
    }),
  } as DocJson;
}

/** Parse + hydrate JSON into a live Doc. Throws ZodError on invalid input. */
export function docFromJson(json: unknown): Doc {
  const parsed = docJsonSchema.parse(json);
  return {
    ...parsed,
    layers: parsed.layers.map((layer) => {
      if (layer.kind !== "heightfield") return layer;
      const res = layer.heightmap.resolution;
      return {
        ...layer,
        heightmap: {
          ...layer.heightmap,
          sublayers: layer.heightmap.sublayers.map((s): Sublayer => {
            if (s.kind === "paint") return { ...s, data: decodeField(s.data, res * res) };
            return s as Sublayer;
          }),
        },
      };
    }),
  } as Doc;
}
