import type { ObjectLayer } from "@paper3d/model";
import { Editor2D } from "../editors/heightmap/Editor2D";
import { ObjectEditor } from "../editors/object/ObjectEditor";
import { Preview3D } from "../preview3d/Preview3D";
import { useDocStore } from "../state/docStore";
import { useUiStore } from "../state/uiStore";
import { PrintPreview } from "./PrintPreview";

/**
 * The center region. Each workspace shows the representations you cross-
 * reference at that stage of the pipeline, side by side.
 *  - Sculpt: edit the selected layer (heightmap or object) + a live 3D view.
 *  - Slice:  the assembled paper lattice, full-size.
 *  - Print:  the actual A4 sheets + a 3D reference of what they build.
 */
export function Workspace() {
  const workspace = useUiStore((s) => s.workspace);
  const selectedId = useUiStore((s) => s.selectedLayerId);
  const doc = useDocStore((s) => s.doc);

  const selectedLayer = doc.layers.find((l) => l.id === selectedId) ?? doc.layers.at(-1);
  const isObject = selectedLayer?.kind === "object";

  if (workspace === "sculpt") {
    return (
      <div className="workspace split">
        <div className="pane pane-major">
          {isObject ? <ObjectEditor layer={selectedLayer as ObjectLayer} /> : <Editor2D />}
        </div>
        <div className="pane pane-minor">
          <Preview3D forceMode={isObject ? "sliced" : "smooth"} chromeless />
        </div>
      </div>
    );
  }

  if (workspace === "print") {
    return (
      <div className="workspace split">
        <div className="pane pane-major">
          <PrintPreview />
        </div>
        <div className="pane pane-minor">
          <Preview3D forceMode="sliced" chromeless />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace">
      <div className="pane">
        <Preview3D />
      </div>
    </div>
  );
}
