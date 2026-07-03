import type { ObjectLayer, ObjectView, Ring2 } from "@paper3d/model";
import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../../state/docStore";
import { type ObjectTool, useUiStore } from "../../state/uiStore";

const TOOLS: { id: ObjectTool; label: string }[] = [
  { id: "select", label: "Select / move" },
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "polygon", label: "Polygon" },
];

export function ObjectEditor({ layer }: { layer: ObjectLayer }) {
  const update = useDocStore((s) => s.update);
  const { objectTool, set } = useUiStore();

  const setView = (view: ObjectView, shapes: Ring2[]) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (l?.kind === "object") l[view] = { shapes };
    });

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
        <span className="hint">
          {objectTool === "polygon"
            ? "click to add points · double-click to finish"
            : objectTool === "select"
              ? "drag a handle to reshape · drag a face to move · Delete removes"
              : "drag to draw"}
        </span>
      </div>
      <div className="ortho-grid">
        <OrthoView
          title="Top — footprint (x · z)"
          hExtent={layer.size.width}
          vExtent={layer.size.depth}
          flipV={false}
          shapes={layer.top.shapes}
          onChange={(s) => setView("top", s)}
        />
        <OrthoView
          title="Front — silhouette (x · height)"
          hExtent={layer.size.width}
          vExtent={layer.size.height}
          flipV
          shapes={layer.front.shapes}
          onChange={(s) => setView("front", s)}
        />
        <OrthoView
          title="Side — silhouette (z · height)"
          hExtent={layer.size.depth}
          vExtent={layer.size.height}
          flipV
          shapes={layer.side.shapes}
          onChange={(s) => setView("side", s)}
        />
      </div>
    </div>
  );
}

type Draft =
  | { kind: "rect" | "circle"; a: [number, number]; b: [number, number] }
  | { kind: "poly"; pts: [number, number][]; cursor: [number, number] };

type DragState =
  | { kind: "vertex"; si: number; vi: number }
  | { kind: "shape"; si: number; last: [number, number] };

const CIRCLE_SEGMENTS = 28;

function OrthoView(props: {
  title: string;
  hExtent: number;
  vExtent: number;
  flipV: boolean;
  shapes: Ring2[];
  onChange: (shapes: Ring2[]) => void;
}) {
  const { title, hExtent, vExtent, flipV, shapes, onChange } = props;
  const tool = useUiStore((s) => s.objectTool);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<DragState | null>(null);

  const handleR = Math.max(hExtent, vExtent) * 0.018;
  const grab = handleR * 1.8;

  const toModel = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const hx = ((e.clientX - rect.left) / rect.width) * hExtent;
    let vy = ((e.clientY - rect.top) / rect.height) * vExtent;
    if (flipV) vy = vExtent - vy;
    return [clamp(hx, 0, hExtent), clamp(vy, 0, vExtent)];
  };

  // Reset any in-progress draft when the tool changes.
  useEffect(() => setDraft(null), []);

  const commit = (next: Ring2[]) => onChange(next);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toModel(e);

    if (tool === "select") {
      // Grab the nearest vertex, else the shape under the cursor.
      let best: { si: number; vi: number; d: number } | null = null;
      for (let si = 0; si < shapes.length; si++) {
        const ring = shapes[si]!;
        for (let vi = 0; vi < ring.length; vi++) {
          const [x, y] = ring[vi]!;
          const d = Math.hypot(x - p[0], y - p[1]);
          if (d < grab && (!best || d < best.d)) best = { si, vi, d };
        }
      }
      if (best) {
        drag.current = { kind: "vertex", si: best.si, vi: best.vi };
        setSelected(best.si);
        return;
      }
      const si = shapes.findIndex((ring) => pointInRing(ring, p));
      if (si >= 0) {
        drag.current = { kind: "shape", si, last: p };
        setSelected(si);
      } else {
        setSelected(null);
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
      const next = shapes.map((r) => r.slice() as Ring2);
      if (d.kind === "vertex") {
        next[d.si]![d.vi] = p;
      } else {
        const dx = p[0] - d.last[0];
        const dy = p[1] - d.last[1];
        next[d.si] = next[d.si]!.map(([x, y]) => [x + dx, y + dy]);
        d.last = p;
      }
      commit(next);
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
        commit([...shapes, rect(x0, y0, x1, y1)]);
      }
      setDraft(null);
    } else if (draft.kind === "circle") {
      const r = Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]);
      if (r > 0.5) commit([...shapes, circle(draft.a, r)]);
      setDraft(null);
    }
  };

  const finishPoly = () => {
    if (draft?.kind === "poly" && draft.pts.length >= 3) {
      commit([...shapes, draft.pts]);
    }
    setDraft(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selected != null) {
      commit(shapes.filter((_, i) => i !== selected));
      setSelected(null);
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
          onDoubleClick={finishPoly}
          onKeyDown={onKeyDown}
        >
          <g transform={flipV ? `translate(0 ${vExtent}) scale(1 -1)` : undefined}>
            {shapes.map((ring, i) => (
              <polygon
                key={`s${i}-${ring.length}`}
                points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                className={`shape ${selected === i ? "sel" : ""}`}
                vectorEffect="non-scaling-stroke"
              />
            ))}
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
              shapes.flatMap((ring, si) =>
                ring.map(([x, y], vi) => (
                  <circle
                    key={`h${si}-${vi}`}
                    cx={x}
                    cy={y}
                    r={handleR}
                    className={`handle ${selected === si ? "sel" : ""}`}
                    vectorEffect="non-scaling-stroke"
                  />
                )),
              )}
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

function pointInRing(ring: Ring2, p: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
