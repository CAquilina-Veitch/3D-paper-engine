import type { GradientSublayer, HeightfieldLayer, PaintSublayer } from "@paper3d/model";
import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../../state/docStore";
import { getCompositor, useFieldStore } from "../../state/fieldStore";
import { useUiStore } from "../../state/uiStore";
import { GradientHandles2D } from "./GradientHandles2D";
import { Ruler } from "./Ruler";
import { paintFieldToCanvas } from "./colormap";
import { Stroke } from "./paint";

export function Editor2D() {
  const doc = useDocStore((s) => s.doc);
  const version = useFieldStore((s) => s.version);
  const ui = useUiStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  const layer =
    (doc.layers.find((l) => l.id === ui.selectedLayerId) as HeightfieldLayer | undefined) ??
    (doc.layers.find((l) => l.kind === "heightfield") as HeightfieldLayer | undefined);
  const res = layer?.heightmap.resolution ?? 512;

  const paintTarget: PaintSublayer | undefined = (() => {
    if (!layer) return undefined;
    const selected = layer.heightmap.sublayers.find((s) => s.id === ui.selectedSublayerId);
    if (selected?.kind === "paint") return selected;
    return layer.heightmap.sublayers.find((s): s is PaintSublayer => s.kind === "paint");
  })();

  // When the active thing is a gradient sublayer, its endpoints are draggable
  // right on the canvas (the gradient's native UV space).
  const gradientTarget = layer?.heightmap.sublayers.find(
    (s): s is GradientSublayer => s.kind === "gradient" && s.id === ui.selectedSublayerId,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintFieldToCanvas(ctx, getCompositor(layer).field, res, ui.shading);
  }, [layer, res, ui.shading, version]);

  if (!layer) return <div className="editor2d empty">No heightfield layer</div>;

  // Live readout: cursor position in world mm + terrain height under it.
  let readout: { x: number; z: number; h: number } | null = null;
  if (cursor) {
    const fx = Math.min(res - 1, Math.max(0, Math.round(cursor[0])));
    const fy = Math.min(res - 1, Math.max(0, Math.round(cursor[1])));
    const h = (getCompositor(layer).field[fy * res + fx] ?? 0) * layer.heightScale;
    readout = {
      x: (cursor[0] / res) * doc.world.width,
      z: (cursor[1] / res) * doc.world.depth,
      h,
    };
  }

  const toField = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * res,
      ((e.clientY - rect.top) / rect.height) * res,
    ];
  };

  return (
    <div className="editor2d">
      <div className="editor2d-toolbar">
        <button
          type="button"
          className={ui.shading === "hypso" ? "active" : ""}
          onClick={() => ui.set({ shading: "hypso" })}
        >
          terrain colors
        </button>
        <button
          type="button"
          className={ui.shading === "gray" ? "active" : ""}
          onClick={() => ui.set({ shading: "gray" })}
        >
          heightmap
        </button>
        <span className="hint">
          {paintTarget
            ? `painting "${paintTarget.name}" — ${ui.brushSign === 1 ? "raise" : "lower"} (alt inverts)`
            : "add a paint sublayer to draw"}
        </span>
      </div>
      <div className="canvas-wrap">
        <div className="canvas-inner">
          <Ruler extentMm={doc.world.width} orientation="top" />
          <Ruler extentMm={doc.world.depth} orientation="left" />
          <canvas
            ref={canvasRef}
            width={res}
            height={res}
            onPointerDown={(e) => {
              if (!paintTarget) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const sign = e.altKey ? (-ui.brushSign as 1 | -1) : ui.brushSign;
              strokeRef.current = new Stroke(layer, paintTarget, {
                size: ui.brushSize,
                hardness: ui.brushHardness,
                opacity: ui.brushOpacity,
                sign,
              });
              const [x, y] = toField(e);
              strokeRef.current.moveTo(x, y, e.pressure || 1);
            }}
            onPointerMove={(e) => {
              const [x, y] = toField(e);
              setCursor([x, y]);
              strokeRef.current?.moveTo(x, y, e.pressure || 1);
            }}
            onPointerUp={() => {
              strokeRef.current?.commit();
              strokeRef.current = null;
            }}
            onPointerLeave={() => setCursor(null)}
          />
          {cursor && paintTarget && (
            <div
              className="brush-cursor"
              style={{
                left: `${(cursor[0] / res) * 100}%`,
                top: `${(cursor[1] / res) * 100}%`,
                width: `${(ui.brushSize / res) * 200}%`,
                height: `${(ui.brushSize / res) * 200}%`,
              }}
            />
          )}
          {gradientTarget && <GradientHandles2D layer={layer} sublayer={gradientTarget} />}
          {readout && (
            <div className="cursor-readout">
              x {readout.x.toFixed(0)} · z {readout.z.toFixed(0)} · h {readout.h.toFixed(1)}
              <span className="unit"> mm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
