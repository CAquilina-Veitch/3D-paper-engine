import { useRef } from "react";
import { ExportDialog } from "./panels/ExportDialog";
import { Inspector } from "./panels/Inspector";
import { LayersPanel } from "./panels/LayersPanel";
import { Scene3D } from "./preview3d/Scene3D";
import { Workspace } from "./shell/Workspace";
import { redo, undo, useDocStore } from "./state/docStore";
import { openDocFile } from "./state/persistence";
import { type ViewMode, type Workspace as WorkspaceId, useUiStore } from "./state/uiStore";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "scene", label: "3D scene" },
  { id: "section", label: "Cross-section" },
];

const WORKSPACES: { id: WorkspaceId; label: string }[] = [
  { id: "sculpt", label: "Sculpt" },
  { id: "slice", label: "Slice" },
  { id: "print", label: "Print" },
];

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
        <div className="tabs view-modes">
          {VIEW_MODES.map((v) => (
            <button
              type="button"
              key={v.id}
              className={ui.viewMode === v.id ? "active" : ""}
              onClick={() => ui.set({ viewMode: v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
        {ui.viewMode === "section" && (
          <div className="tabs">
            {WORKSPACES.map((w) => (
              <button
                type="button"
                key={w.id}
                className={ui.workspace === w.id ? "active" : ""}
                onClick={() => ui.set({ workspace: w.id })}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
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
        <main className="center">{ui.viewMode === "scene" ? <Scene3D /> : <Workspace />}</main>
        <aside className="right">
          <Inspector />
        </aside>
      </div>
      {ui.exportOpen && <ExportDialog />}
    </div>
  );
}
