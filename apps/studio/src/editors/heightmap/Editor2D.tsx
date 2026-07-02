import type { HeightfieldLayer, PaintSublayer } from "@paper3d/model";
import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../../state/docStore";
import { getCompositor, useFieldStore } from "../../state/fieldStore";
import { useUiStore } from "../../state/uiStore";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintFieldToCanvas(ctx, getCompositor(layer).field, res, ui.shading);
  }, [layer, res, ui.shading, version]);

  if (!layer) return <div className="editor2d empty">No heightfield layer</div>;

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
        </div>
      </div>
    </div>
  );
}
