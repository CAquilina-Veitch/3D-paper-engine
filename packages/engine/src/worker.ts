import type { Doc } from "@paper3d/model";
import * as Comlink from "comlink";
import { compositeDoc } from "./field/compositeDoc";
import { type LayoutResult, layoutPages } from "./layout/pages";
import { renderPdf } from "./render/pdf";
import { renderPageSvg } from "./render/svg";
import { type SlicedModel, sliceDoc } from "./slicing/slicer";

export interface SliceResult {
  model: SlicedModel;
  layout: LayoutResult;
}

export interface ExportResult {
  pdfBytes: Uint8Array;
  pageCount: number;
}

/**
 * Heavy pipeline off the main thread. Docs arrive via structured clone
 * (Float32Array paint data transfers natively). Cancellation is handled
 * client-side with a generation counter — slicing is fast enough that
 * letting a stale run finish is cheaper than tearing down the worker.
 */
const api = {
  slice(doc: Doc): SliceResult {
    const fields = compositeDoc(doc);
    const model = sliceDoc(doc, fields);
    const layout = layoutPages(doc, model);
    return { model, layout };
  },

  async exportPdf(doc: Doc): Promise<ExportResult> {
    const { layout } = api.slice(doc);
    const pdfBytes = await renderPdf(layout.program);
    return { pdfBytes, pageCount: layout.pageCount };
  },

  pageSvgs(doc: Doc): string[] {
    const { layout } = api.slice(doc);
    return layout.program.pages.map(renderPageSvg);
  },
};

export type EngineWorkerApi = typeof api;

Comlink.expose(api);
