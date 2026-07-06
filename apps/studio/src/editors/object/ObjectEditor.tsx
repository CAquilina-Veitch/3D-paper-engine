import { partProjection, pointInRing } from "@paper3d/engine";
import {
  type ObjectLayer,
  type ObjectPart,
  type ObjectView,
  type Ring2,
  newId,
} from "@paper3d/model";
import { useMemo, useRef, useState } from "react";
import { useDocStore } from "../../state/docStore";
import { type ObjectTool, useUiStore } from "../../state/uiStore";

const TOOLS: { id: ObjectTool; label: string }[] = [
  { id: "select", label: "Select / move" },
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "polygon", label: "Polygon" },
];

/** Which model axes a view's (horizontal, vertical) coordinates are. */
const VIEW_AXES: Record<ObjectView, [Axis, Axis]> = {
  top: ["x", "z"],
  front: ["x", "y"],
  side: ["z", "y"],
};

type Axis = "x" | "y" | "z";

/** Where each model axis lives inside a part's per-view profiles. */
const AXIS_SLOTS: Record<Axis, [ObjectView, 0 | 1][]> = {
  x: [
    ["top", 0],
    ["front", 0],
  ],
  z: [
    ["top", 1],
    ["side", 0],
  ],
  y: [
    ["front", 1],
    ["side", 1],
  ],
};

/**
 * The object editor: three orthographic views of ONE shared parts model.
 * Drawing a shape in any view creates a 3D part; every other view shows that
 * part's real projected silhouette (a ghost) which can be selected and moved
 * — moving a ghost moves the part itself, in whichever profiles carry the
 * view's axes. Double-clicking a ghost materializes the projection into an
 * editable silhouette for that view (carving the part). Overlapping shapes
 * union; "cut" shapes subtract (holes).
 */
export function ObjectEditor({ layer }: { layer: ObjectLayer }) {
  const update = useDocStore((s) => s.update);
  const { objectTool, objectMode, set } = useUiStore();
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const mutate = (fn: (l: ObjectLayer) => void) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (l?.kind === "object") fn(l);
    });

  const ops: PartOps = {
    addPart: (view, ring) => {
      const id = newId("part");
      const profiles: ObjectPart["profiles"] = {};
      profiles[view] = ring;
      mutate((l) => {
        l.parts.push({ id, mode: objectMode === "cut" ? "subtract" : "add", profiles });
      });
      setSelectedPartId(id);
    },
    deletePart: (partId) => {
      mutate((l) => {
        l.parts = l.parts.filter((p) => p.id !== partId);
      });
      setSelectedPartId(null);
    },
    setProfile: (partId, view, ring) =>
      mutate((l) => {
        const p = l.parts.find((x) => x.id === partId);
        if (p) p.profiles[view] = ring;
      }),
    movePart: (partId, view, dh, dv) =>
      mutate((l) => {
        const p = l.parts.find((x) => x.id === partId);
        if (!p) return;
        const [hAxis, vAxis] = VIEW_AXES[view];
        translateAxis(p.profiles, hAxis, dh);
        translateAxis(p.profiles, vAxis, dv);
      }),
  };

  return (
    <div className="object-editor">
      <div className="editor2d-toolbar">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={objectTool === t.id ? "active" : ""}
            onClick={() => set({ objectTool: t.id })}
          >
            {t.label}
          </button>
        ))}
        <span className="view-modes">
          <button
            type="button"
            className={objectMode === "add" ? "active" : ""}
            title="New shapes union into the object"
            onClick={() => set({ objectMode: "add" })}
          >
            Add
          </button>
          <button
            type="button"
            className={objectMode === "cut" ? "active" : ""}
            title="New shapes cut holes out of the object"
            onClick={() => set({ objectMode: "cut" })}
          >
            Cut
          </button>
        </span>
        <span className="hint">
          {objectTool === "polygon"
            ? "click to add points · double-click to finish"
            : objectTool === "select"
              ? "drag to move (any view) · handles reshape · double-click a ghost to carve here · Delete removes"
              : "drag to draw — the shape appears in every view"}
        </span>
      </div>
      <div className="ortho-grid">
        <OrthoView
          view="top"
          title="Top — footprint (x · z)"
          layer={layer}
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
          ops={ops}
        />
        <OrthoView
          view="front"
          title="Front — silhouette (x · height)"
          layer={layer}
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
          ops={ops}
        />
        <OrthoView
          view="side"
          title="Side — silhouette (z · height)"
          layer={layer}
          selectedPartId={selectedPartId}
          onSelectPart={setSelectedPartId}
          ops={ops}
        />
      </div>
    </div>
  );
}

interface PartOps {
  addPart: (view: ObjectView, ring: Ring2) => void;
  deletePart: (partId: string) => void;
  setProfile: (partId: string, view: ObjectView, ring: Ring2) => void;
  movePart: (partId: string, view: ObjectView, dh: number, dv: number) => void;
}

function translateAxis(
  profiles: { top?: Ring2; front?: Ring2; side?: Ring2 },
  axis: Axis,
  d: number,
) {
  if (d === 0) return;
  for (const [view, ci] of AXIS_SLOTS[axis]) {
    const ring = profiles[view];
    if (!ring) continue;
    for (const pt of ring) pt[ci] += d;
  }
}

type Draft =
  | { kind: "rect" | "circle"; a: [number, number]; b: [number, number] }
  | { kind: "poly"; pts: [number, number][]; cursor: [number, number] };

type DragState =
  | { kind: "vertex"; partId: string; vi: number }
  | { kind: "move"; partId: string; last: [number, number] };

const CIRCLE_SEGMENTS = 28;

function OrthoView(props: {
  view: ObjectView;
  title: string;
  layer: ObjectLayer;
  selectedPartId: string | null;
  onSelectPart: (id: string | null) => void;
  ops: PartOps;
}) {
  const { view, title, layer, selectedPartId, onSelectPart, ops } = props;
  const tool = useUiStore((s) => s.objectTool);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const drag = useRef<DragState | null>(null);

  const { size } = layer;
  const hExtent = view === "side" ? size.depth : size.width;
  const vExtent = view === "top" ? size.depth : size.height;
  const flipV = view !== "top";

  // Every part, with its silhouette in this view: its own editable profile,
  // or the true projection of the part's solid (a ghost).
  const entries = useMemo(
    () =>
      layer.parts.map((part) => ({
        part,
        own: part.profiles[view],
        rings: partProjection(part, size, view),
      })),
    [layer.parts, size, view],
  );

  const handleR = Math.max(hExtent, vExtent) * 0.018;
  const grab = handleR * 1.8;

  const toModel = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const hx = ((e.clientX - rect.left) / rect.width) * hExtent;
    let vy = ((e.clientY - rect.top) / rect.height) * vExtent;
    if (flipV) vy = vExtent - vy;
    return [clamp(hx, 0, hExtent), clamp(vy, 0, vExtent)];
  };

  const hitEntry = (p: [number, number]) => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.rings.some((ring) => pointInRing(ring, p[0], p[1]))) return entries[i]!;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toModel(e);

    if (tool === "select") {
      // Grab the nearest editable vertex, else the part under the cursor.
      let best: { partId: string; vi: number; d: number } | null = null;
      for (const { part, own } of entries) {
        if (!own) continue;
        for (let vi = 0; vi < own.length; vi++) {
          const [x, y] = own[vi]!;
          const d = Math.hypot(x - p[0], y - p[1]);
          if (d < grab && (!best || d < best.d)) best = { partId: part.id, vi, d };
        }
      }
      if (best) {
        drag.current = { kind: "vertex", partId: best.partId, vi: best.vi };
        onSelectPart(best.partId);
        return;
      }
      const hit = hitEntry(p);
      if (hit) {
        drag.current = { kind: "move", partId: hit.part.id, last: p };
        onSelectPart(hit.part.id);
      } else {
        onSelectPart(null);
      }
      return;
    }

    if (tool === "rect" || tool === "circle") {
      setDraft({ kind: tool, a: p, b: p });
      return;
    }
    if (tool === "polygon") {
      setDraft((d) =>
        d && d.kind === "poly"
          ? { kind: "poly", pts: [...d.pts, p], cursor: p }
          : { kind: "poly", pts: [p], cursor: p },
      );
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toModel(e);
    if (drag.current) {
      const d = drag.current;
      if (d.kind === "vertex") {
        const own = layer.parts.find((x) => x.id === d.partId)?.profiles[view];
        if (own) {
          const next = own.map((pt) => [...pt] as [number, number]);
          next[d.vi] = p;
          ops.setProfile(d.partId, view, next);
        }
      } else {
        ops.movePart(d.partId, view, p[0] - d.last[0], p[1] - d.last[1]);
        d.last = p;
      }
      return;
    }
    if (draft && (draft.kind === "rect" || draft.kind === "circle")) {
      setDraft({ ...draft, b: p });
    } else if (draft && draft.kind === "poly") {
      setDraft({ ...draft, cursor: p });
    }
  };

  const onPointerUp = () => {
    if (drag.current) {
      drag.current = null;
      return;
    }
    if (!draft) return;
    if (draft.kind === "rect") {
      const [x0, y0] = draft.a;
      const [x1, y1] = draft.b;
      if (Math.abs(x1 - x0) > 0.5 && Math.abs(y1 - y0) > 0.5) {
        ops.addPart(view, rect(x0, y0, x1, y1));
      }
      setDraft(null);
    } else if (draft.kind === "circle") {
      const r = Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]);
      if (r > 0.5) ops.addPart(view, circle(draft.a, r));
      setDraft(null);
    }
  };

  const finishPoly = () => {
    if (draft?.kind === "poly" && draft.pts.length >= 3) {
      ops.addPart(view, draft.pts);
    }
    setDraft(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool === "polygon") {
      finishPoly();
      return;
    }
    if (tool !== "select") return;
    // Materialize a ghost's projection into an editable silhouette here.
    const p = toModel(e);
    const hit = hitEntry(p);
    if (hit && !hit.own) {
      const ring = hit.rings.find((r) => pointInRing(r, p[0], p[1])) ?? hit.rings[0];
      if (ring) ops.setProfile(hit.part.id, view, ring);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedPartId != null) {
      ops.deletePart(selectedPartId);
    }
    if (e.key === "Enter") finishPoly();
    if (e.key === "Escape") setDraft(null);
  };

  const draftRing =
    draft?.kind === "rect"
      ? rect(draft.a[0], draft.a[1], draft.b[0], draft.b[1])
      : draft?.kind === "circle"
        ? circle(draft.a, Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]))
        : null;

  const selectedOwn = entries.find((en) => en.part.id === selectedPartId && en.own)?.own;

  return (
    <div className="ortho">
      <div className="ortho-title">{title}</div>
      <div className="ortho-canvas" style={{ aspectRatio: `${hExtent} / ${vExtent}` }}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG drawing surface */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via onKeyDown */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${hExtent} ${vExtent}`}
          preserveAspectRatio="none"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
        >
          <g transform={flipV ? `translate(0 ${vExtent}) scale(1 -1)` : undefined}>
            {entries.flatMap(({ part, own, rings }) =>
              rings.map((ring, ri) => (
                <polygon
                  key={`${part.id}-${ri}-${ring.length}`}
                  points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                  className={[
                    "shape",
                    own ? "" : "ghost",
                    part.mode === "subtract" ? "cut" : "",
                    part.id === selectedPartId ? "sel" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  vectorEffect="non-scaling-stroke"
                />
              )),
            )}
            {draftRing && (
              <polygon
                points={draftRing.map(([x, y]) => `${x},${y}`).join(" ")}
                className="shape draft"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {draft?.kind === "poly" && (
              <polyline
                points={[...draft.pts, draft.cursor].map(([x, y]) => `${x},${y}`).join(" ")}
                className="draft-line"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {tool === "select" &&
              selectedOwn?.map(([x, y], vi) => (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: vertices have no identity beyond position
                  key={`h${vi}`}
                  cx={x}
                  cy={y}
                  r={handleR}
                  className="handle sel"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

function rect(x0: number, y0: number, x1: number, y1: number): Ring2 {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

function circle(center: [number, number], r: number): Ring2 {
  const out: Ring2 = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const t = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    out.push([center[0] + Math.cos(t) * r, center[1] + Math.sin(t) * r]);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
