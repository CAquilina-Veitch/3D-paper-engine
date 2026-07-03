import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { layoutPages } from "../src/layout/pages";
import { renderPageSvg } from "../src/render/svg";
import { sliceDoc } from "../src/slicing/slicer";
import { testDoc } from "./helpers";

/**
 * Not an assertion test: writes the rendered pages as SVG next to the
 * snapshots so a human can eyeball the print output in a browser.
 * (svg.ts and pdf.ts consume the same PageProgram, so this is what the
 * PDF looks like.)
 */
describe("visual dump", () => {
  it("writes page SVGs to test/__visual__", () => {
    const { doc, fields } = testDoc(1);
    const layout = layoutPages(doc, sliceDoc(doc, fields));
    const dir = fileURLToPath(new URL("./__visual__/", import.meta.url));
    mkdirSync(dir, { recursive: true });
    layout.program.pages.forEach((page, i) => {
      writeFileSync(`${dir}page-${i + 1}.svg`, renderPageSvg(page));
    });
  });
});
