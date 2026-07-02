import { useRef } from "react";
import { Editor2D } from "./editors/heightmap/Editor2D";
import { ExportDialog } from "./panels/ExportDialog";
import { Inspector } from "./panels/Inspector";
import { LayersPanel } from "./panels/LayersPanel";
import { Preview3D } from "./preview3d/Preview3D";
import { redo, undo, useDocStore } from "./state/docStore";
import { openDocFile } from "./state/persistence";
import { useUiStore } from "./state/uiStore";

export function App() {
  const doc = useDocStore((s) => s.doc);
  const setDoc = useDocStore((s) => s.setDoc);
  const update = useDocStore((s) => s.update);
  const ui = useUiStore();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">3D Paper Engine</span>
        <input
          className="doc-name"
          value={doc.name}
          onChange={(e) => update((d) => void (d.name = e.target.value))}
        />
        <div className="tabs">
          <button
            type="button"
            className={ui.tab === "2d" ? "active" : ""}
            onClick={() => ui.set({ tab: "2d" })}
          >
            2D heightmap
          </button>
          <button
            type="button"
            className={ui.tab === "3d" ? "active" : ""}
            onClick={() => ui.set({ tab: "3d" })}
          >
            3D preview
          </button>
        </div>
        <div className="spacer" />
        <button type="button" onClick={undo} title="Undo (ctrl+z)">
          ↩
        </button>
        <button type="button" onClick={redo} title="Redo">
          ↪
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Open
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".paper3d,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setDoc(await openDocFile(file));
            e.target.value = "";
          }}
        />
        <button type="button" className="primary" onClick={() => ui.set({ exportOpen: true })}>
          Export PDF
        </button>
      </header>
      <div className="body">
        <aside className="left">
          <LayersPanel />
        </aside>
        <main className="center">{ui.tab === "2d" ? <Editor2D /> : <Preview3D />}</main>
        <aside className="right">
          <Inspector />
        </aside>
      </div>
      {ui.exportOpen && <ExportDialog />}
    </div>
  );
}
