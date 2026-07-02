import type { Doc } from "@paper3d/model";
import { planePoint } from "../slicing/planes";
import type { SlicedModel } from "../slicing/slicer";
import type { PageOp } from "./pageProgram";

const FAMILY_LETTERS = "ABCDEFGH";

/**
 * Top-down assembly map: the world footprint with every slice plane drawn
 * and labeled, so the builder knows where each lettered piece goes.
 */
export function assemblyMapOps(
  doc: Doc,
  model: SlicedModel,
  x: number,
  y: number,
  maxSize: number,
): PageOp[] {
  const ops: PageOp[] = [];
  const scale = Math.min(maxSize / doc.world.width, maxSize / doc.world.depth);
  const w = doc.world.width * scale;
  const d = doc.world.depth * scale;

  ops.push({
    kind: "text",
    at: [x, y - 3],
    text: "Assembly map (top view) — slide pieces together at the crossings; family A opens up, B opens down",
    sizePt: 8,
    color: "black",
  });

  ops.push({
    kind: "path",
    rings: [
      [
        [x, y],
        [x + w, y],
        [x + w, y + d],
        [x, y + d],
      ],
    ],
    style: "aux",
  });

  for (const plane of model.planes) {
    const [px0, pz0] = planePoint(plane, plane.u0);
    const [px1, pz1] = planePoint(plane, plane.u1);
    const from: [number, number] = [x + px0 * scale, y + pz0 * scale];
    const to: [number, number] = [x + px1 * scale, y + pz1 * scale];
    ops.push({ kind: "line", from, to, style: "faint" });
    const letter = FAMILY_LETTERS[plane.familyIndex] ?? "?";
    const label = `${letter}${plane.index + 1}`;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    ops.push({
      kind: "text",
      at: [from[0] - (dx / len) * 1 - 3.5, from[1] - (dy / len) * 1 + 1],
      text: label,
      sizePt: 5,
      color: "gray",
      anchor: "middle",
    });
  }

  return ops;
}
