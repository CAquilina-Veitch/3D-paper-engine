import type { Doc } from "@paper3d/model";
import { labelPoint } from "../geom2/labelPoint";
import { type Box2, type Polygon, type Vec2, polygonBox } from "../geom2/types";
import { sceneSamplers } from "../solid/combine";
import type { FieldMap, SolidContext } from "../solid/heightfield";
import { type Crossing, planeCrossings } from "./crossings";
import { type SlicePlane, strategyPlanes } from "./planes";
import { planeProfile } from "./profile";
import { type SlotSpec, applySlots, crossingSlots } from "./slots";
import type { ModelWarning, PieceWarning } from "./warnings";

export interface Piece {
  id: string;
  layerId: string;
  planeId: string;
  familyIndex: number;
  indexInFamily: number;
  /** 0 when the plane produced a single piece; 1-based otherwise. */
  island: number;
  /** "A3", or "A3.1" for islands. */
  label: string;
  outline: Vec2[];
  holes: Vec2[][];
  slots: SlotSpec[];
  warnings: PieceWarning[];
  bbox: Box2;
  labelAnchor: Vec2;
  labelClearance: number;
  /** For placing the piece back into 3D: world point = origin + u·dir, y = v. */
  plane: { origin: [number, number]; dir: [number, number] };
}

export interface SlicedModel {
  pieces: Piece[];
  planes: SlicePlane[];
  warnings: ModelWarning[];
}

const FAMILY_LETTERS = "ABCDEFGH";

export function sliceDoc(doc: Doc, fields: FieldMap): SlicedModel {
  const ctx: SolidContext = { doc, fields };
  const samplers = sceneSamplers(ctx);
  const warnings: ModelWarning[] = [];
  const pieces: Piece[] = [];
  const allPlanes: SlicePlane[] = [];

  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    const sampler = samplers.get(layer.id);
    if (!sampler) continue;

    const planes = strategyPlanes(layer.id, layer.slicing, doc.world, warnings);
    allPlanes.push(...planes);

    const profiles = new Map<string, Polygon[]>();
    for (const plane of planes) profiles.set(plane.id, planeProfile(plane, sampler));

    const slotsByPlane = new Map<string, SlotSpec[]>();
    if (layer.slicing.assembly === "interlock") {
      const openingFor = (familyId: string) =>
        layer.slicing.families.find((f) => f.id === familyId)?.slotOpening ?? "top";
      for (const crossing of planeCrossings(planes)) {
        const pair = crossingSlots(crossing, sampler, doc.print, openingFor);
        if (!pair) continue;
        pushSlot(slotsByPlane, crossing.a.id, pair.a);
        pushSlot(slotsByPlane, crossing.b.id, pair.b);
      }
      detectSlotCollisions(layer.id, planes, slotsByPlane, warnings);
    }

    for (const plane of planes) {
      const profile = profiles.get(plane.id) ?? [];
      if (profile.length === 0) continue;
      const slots = (slotsByPlane.get(plane.id) ?? []).sort((a, b) => a.u - b.u);
      const box = profile.map(polygonBox).reduce(mergeBox);
      const { islands, severed } = applySlots(profile, slots, box.minY, box.maxY);

      islands.forEach((island, islandIdx) => {
        const islandBox = polygonBox(island);
        const islandSlots = slots.filter(
          (s) => s.u >= islandBox.minX - s.width && s.u <= islandBox.maxX + s.width,
        );
        const pieceWarnings: PieceWarning[] = islandSlots.flatMap((s) => s.warnings);
        if (severed) {
          pieceWarnings.push({
            type: "severed",
            detail:
              "slots cut this slice into separate pieces — raise the base pedestal or increase spacing",
          });
        }
        const edgeSlots = islandSlots.filter(
          (s) =>
            s.u - s.width / 2 < islandBox.minX + doc.print.minWeb ||
            s.u + s.width / 2 > islandBox.maxX - doc.print.minWeb,
        );
        for (const s of edgeSlots) {
          pieceWarnings.push({
            type: "edge-slot",
            u: s.u,
            detail: "slot is very close to the end of the piece",
          });
        }

        const { point, clearance } = labelPoint(island);
        const letter = FAMILY_LETTERS[plane.familyIndex] ?? `F${plane.familyIndex}`;
        const baseLabel = `${letter}${plane.index + 1}`;
        const label = islands.length > 1 ? `${baseLabel}.${islandIdx + 1}` : baseLabel;
        pieces.push({
          id: islands.length > 1 ? `${plane.id}#${islandIdx + 1}` : plane.id,
          layerId: layer.id,
          planeId: plane.id,
          familyIndex: plane.familyIndex,
          indexInFamily: plane.index,
          island: islands.length > 1 ? islandIdx + 1 : 0,
          label,
          outline: island.outline,
          holes: island.holes,
          slots: islandSlots,
          warnings: pieceWarnings,
          bbox: islandBox,
          labelAnchor: point,
          labelClearance: clearance,
          plane: { origin: plane.origin, dir: plane.dir },
        });
      });
    }
  }

  return { pieces, planes: allPlanes, warnings };
}

function pushSlot(map: Map<string, SlotSpec[]>, planeId: string, slot: SlotSpec): void {
  const list = map.get(planeId);
  if (list) list.push(slot);
  else map.set(planeId, [slot]);
}

/** Two slots on one plane closer than a slot width cannot both work. */
function detectSlotCollisions(
  layerId: string,
  planes: SlicePlane[],
  slotsByPlane: Map<string, SlotSpec[]>,
  warnings: ModelWarning[],
): void {
  for (const plane of planes) {
    const slots = slotsByPlane.get(plane.id);
    if (!slots || slots.length < 2) continue;
    const sorted = slots.slice().sort((a, b) => a.u - b.u);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.u - sorted[i - 1]!.u;
      const need = (sorted[i]!.width + sorted[i - 1]!.width) / 2;
      if (gap < need) {
        warnings.push({
          type: "triple-intersection",
          layerId,
          detail: `slots collide on a slice (gap ${gap.toFixed(2)}mm) — nudge a family's phase so crossings don't coincide`,
        });
      }
    }
  }
}

function mergeBox(a: Box2, b: Box2): Box2 {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}
