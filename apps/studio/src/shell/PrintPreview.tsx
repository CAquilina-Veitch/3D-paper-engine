import { renderPageSvg } from "@paper3d/engine";
import { useSliceStore } from "../state/engineClient";

/**
 * Renders the actual A4 page program in-app — the same PageProgram the PDF
 * export uses, drawn to SVG — so you can see and page through the print
 * output without exporting first.
 */
export function PrintPreview() {
  const result = useSliceStore((s) => s.result);
  const busy = useSliceStore((s) => s.busy);

  if (!result) {
    return <div className="print-preview empty">{busy ? "Slicing…" : "Nothing to print yet"}</div>;
  }

  const pages = result.layout.program.pages;
  return (
    <div className="print-preview">
      {pages.map((page, i) => (
        <figure className="print-page" key={`page-${i}-${page.ops.length}`}>
          <figcaption className="print-page-label">
            {i === 0 ? "Page 1 — calibration + assembly map" : `Page ${i + 1} of ${pages.length}`}
          </figcaption>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: engine-generated SVG, no user-supplied HTML */}
          <div
            className="print-page-svg"
            dangerouslySetInnerHTML={{ __html: renderPageSvg(page) }}
          />
        </figure>
      ))}
    </div>
  );
}
