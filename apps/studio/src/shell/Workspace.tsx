import { Editor2D } from "../editors/heightmap/Editor2D";
import { Preview3D } from "../preview3d/Preview3D";
import { useUiStore } from "../state/uiStore";
import { PrintPreview } from "./PrintPreview";

/**
 * The center region. Each workspace shows the representations you cross-
 * reference at that stage of the pipeline, side by side.
 *  - Sculpt: paint the heightmap, watch the terrain grow live.
 *  - Slice:  the assembled paper lattice, full-size.
 *  - Print:  the actual A4 sheets + a 3D reference of what they build.
 */
export function Workspace() {
  const workspace = useUiStore((s) => s.workspace);

  if (workspace === "sculpt") {
    return (
      <div className="workspace split">
        <div className="pane pane-major">
          <Editor2D />
        </div>
        <div className="pane pane-minor">
          <Preview3D forceMode="smooth" chromeless />
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
