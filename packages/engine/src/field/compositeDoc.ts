import type { Doc } from "@paper3d/model";
import type { FieldMap } from "../solid/heightfield";
import { Compositor } from "./compositor";

/** Composite every heightfield layer's stack into a FieldMap for slicing. */
export function compositeDoc(doc: Doc): FieldMap {
  const fields: FieldMap = new Map();
  for (const layer of doc.layers) {
    if (layer.kind !== "heightfield") continue;
    const compositor = new Compositor(layer.heightmap.resolution);
    compositor.compositeAll(layer.heightmap);
    fields.set(layer.id, compositor.field);
  }
  return fields;
}
