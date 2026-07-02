import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useDocStore } from "../state/docStore";
import { useSliceStore } from "../state/engineClient";
import { type PreviewMode, useUiStore } from "../state/uiStore";
import { SlicedPieces } from "./SlicedPieces";
import { SmoothMesh } from "./SmoothMesh";

/**
 * @param forceMode  render this mode regardless of the global toggle (for embedded panes)
 * @param chromeless hide the mode/explode toolbar (for small reference panes)
 */
export function Preview3D({
  forceMode,
  chromeless,
}: {
  forceMode?: PreviewMode;
  chromeless?: boolean;
} = {}) {
  const doc = useDocStore((s) => s.doc);
  const ui = useUiStore();
  const busy = useSliceStore((s) => s.busy);

  const cx = doc.world.width / 2;
  const cz = doc.world.depth / 2;
  const mode = forceMode ?? ui.previewMode;

  return (
    <div className="preview3d">
      {!chromeless && (
        <div className="editor2d-toolbar">
          <button
            type="button"
            className={ui.previewMode === "sliced" ? "active" : ""}
            onClick={() => ui.set({ previewMode: "sliced" })}
          >
            paper pieces
          </button>
          <button
            type="button"
            className={ui.previewMode === "smooth" ? "active" : ""}
            onClick={() => ui.set({ previewMode: "smooth" })}
          >
            smooth
          </button>
          <label className="field inline">
            <span>explode</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={ui.explode}
              onChange={(e) => ui.set({ explode: Number(e.target.value) })}
            />
          </label>
          {busy && <span className="hint">slicing…</span>}
        </div>
      )}
      <Canvas
        // Continuous render loop so pieces appear as soon as the worker's
        // slice result lands, without needing a user interaction to wake it.
        frameloop="always"
        camera={{ position: [cx + 160, 150, cz + 190], fov: 40, near: 1, far: 4000 }}
        style={{ background: "#102621" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[200, 400, 100]} intensity={1.4} />
        <directionalLight position={[-150, 200, -200]} intensity={0.4} />
        <group position={[0, 0, 0]}>
          {mode === "smooth" ? <SmoothMesh /> : <SlicedPieces explode={ui.explode} />}
          <gridHelper
            args={[Math.max(doc.world.width, doc.world.depth) * 2, 20, "#2f5a4f", "#1c3b34"]}
            position={[cx, -doc.print.basePedestal - 1, cz]}
          />
        </group>
        <OrbitControls target={[cx, 20, cz]} />
      </Canvas>
    </div>
  );
}
