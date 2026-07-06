import type { GradientSublayer, HeightfieldLayer } from "@paper3d/model";
import { useDocStore } from "../../state/docStore";

/**
 * Draggable gradient endpoints overlaid on the 2D heightmap canvas — the
 * gradient's native UV space, so handle position maps 1:1 to from/to.
 * Kept in sync with the 3D scene handles via the shared doc state.
 */
export function GradientHandles2D(props: { layer: HeightfieldLayer; sublayer: GradientSublayer }) {
  const update = useDocStore((s) => s.update);
  const { layer, sublayer } = props;

  const setEnd = (key: "from" | "to", uv: [number, number]) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (l?.kind !== "heightfield") return;
      const s = l.heightmap.sublayers.find((x) => x.id === sublayer.id);
      if (s?.kind === "gradient") s[key] = uv;
    });

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const dragHandlers = (key: "from" | "to") => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const overlay = e.currentTarget.parentElement;
      if (!overlay) throw new Error("gradient handle rendered outside its overlay");
      const rect = overlay.getBoundingClientRect();
      setEnd(key, [
        clamp01((e.clientX - rect.left) / rect.width),
        clamp01((e.clientY - rect.top) / rect.height),
      ]);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
  });

  const [fu, fv] = sublayer.from;
  const [tu, tv] = sublayer.to;

  return (
    <div className="grad-overlay">
      <svg aria-hidden="true">
        <line x1={`${fu * 100}%`} y1={`${fv * 100}%`} x2={`${tu * 100}%`} y2={`${tv * 100}%`} />
      </svg>
      <div
        className="grad-handle from"
        title="Gradient from"
        style={{ left: `${fu * 100}%`, top: `${fv * 100}%` }}
        {...dragHandlers("from")}
      />
      <div
        className="grad-handle to"
        title="Gradient to"
        style={{ left: `${tu * 100}%`, top: `${tv * 100}%` }}
        {...dragHandlers("to")}
      />
    </div>
  );
}
