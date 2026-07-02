import { useState } from "react";
import { useDocStore } from "../state/docStore";
import { engine, useSliceStore } from "../state/engineClient";
import { downloadDoc, downloadPdf } from "../state/persistence";
import { useUiStore } from "../state/uiStore";

export function ExportDialog() {
  const doc = useDocStore((s) => s.doc);
  const result = useSliceStore((s) => s.result);
  const set = useUiStore((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warningCount =
    (result?.model.pieces.reduce((acc, p) => acc + p.warnings.length, 0) ?? 0) +
    (result?.model.warnings.length ?? 0);

  const exportPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const { pdfBytes } = await engine.exportPdf(useDocStore.getState().doc);
      downloadPdf(pdfBytes, doc.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => set({ exportOpen: false })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export</h2>
        {result ? (
          <p>
            {result.model.pieces.length} pieces on {result.layout.pageCount} A4 pages (page 1 is
            calibration + assembly map).
          </p>
        ) : (
          <p>Slicing…</p>
        )}
        {warningCount > 0 && (
          <p className="warning">
            ⚠ {warningCount} warning{warningCount === 1 ? "" : "s"} — affected pieces print with
            dashed outlines. Check the Inspector's Output section.
          </p>
        )}
        <p className="hint">
          Print at 100% scale on A4 cardstock (~200gsm works well). Verify with the ruler on page 1
          before cutting.
        </p>
        {error && <p className="warning">{error}</p>}
        <div className="modal-buttons">
          <button type="button" disabled={busy || !result} onClick={exportPdf}>
            {busy ? "Rendering…" : "Download PDF"}
          </button>
          <button type="button" onClick={() => downloadDoc(useDocStore.getState().doc)}>
            Save design (.paper3d)
          </button>
          <button type="button" onClick={() => set({ exportOpen: false })}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
