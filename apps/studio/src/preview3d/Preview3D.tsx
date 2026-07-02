import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useDocStore } from "../state/docStore";
import { useSliceStore } from "../state/engineClient";
import { useUiStore } from "../state/uiStore";
import { SlicedPieces } from "./SlicedPieces";
import { SmoothMesh } from "./SmoothMesh";

export function Preview3D() {
  const doc = useDocStore((s) => s.doc);
  const ui = useUiStore();
  const busy = useSliceStore((s) => s.busy);

  const cx = doc.world.width / 2;
  const cz = doc.world.depth / 2;

  return (
    <div className="preview3d">
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
      <Canvas
        camera={{ position: [cx + 160, 150, cz + 190], fov: 40, near: 1, far: 4000 }}
        style={{ background: "#15181d" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[200, 400, 100]} intensity={1.4} />
        <directionalLight position={[-150, 200, -200]} intensity={0.4} />
        <group position={[0, 0, 0]}>
          {ui.previewMode === "smooth" ? <SmoothMesh /> : <SlicedPieces explode={ui.explode} />}
          <gridHelper
            args={[Math.max(doc.world.width, doc.world.depth) * 2, 20, "#3a4048", "#23272e"]}
            position={[cx, -doc.print.basePedestal - 1, cz]}
          />
        </group>
        <OrbitControls target={[cx, 20, cz]} />
      </Canvas>
    </div>
  );
}
