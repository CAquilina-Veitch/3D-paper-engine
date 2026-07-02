import { type PageOps, STYLE_WIDTH_PT } from "../layout/pageProgram";

const PT_TO_MM = 25.4 / 72;
const GRAY = "#737373";

/** Render one page to an SVG string (mm coordinate space, y down). */
export function renderPageSvg(page: PageOps): string {
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.widthMm}mm" height="${page.heightMm}mm" viewBox="0 0 ${page.widthMm} ${page.heightMm}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${page.widthMm}" height="${page.heightMm}" fill="white"/>`,
  );

  for (const op of page.ops) {
    switch (op.kind) {
      case "path": {
        const d = op.rings
          .map((ring) => `M${ring.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`)
          .join("");
        const dash = op.dashed ? ' stroke-dasharray="1.2 0.8"' : "";
        parts.push(
          `<path d="${d}" fill="none" stroke="black" stroke-width="${strokeW(op.style)}"${dash} fill-rule="evenodd"/>`,
        );
        break;
      }
      case "line": {
        const dash = op.dashed ? ' stroke-dasharray="1.2 0.8"' : "";
        parts.push(
          `<line x1="${round(op.from[0])}" y1="${round(op.from[1])}" x2="${round(op.to[0])}" y2="${round(op.to[1])}" stroke="black" stroke-width="${strokeW(op.style)}"${dash}/>`,
        );
        break;
      }
      case "circle": {
        const fill = op.filled ? GRAY : "none";
        parts.push(
          `<circle cx="${round(op.at[0])}" cy="${round(op.at[1])}" r="${op.r}" fill="${fill}" stroke="${op.filled ? "none" : GRAY}" stroke-width="${strokeW(op.style)}"/>`,
        );
        break;
      }
      case "text": {
        const sizeMm = op.sizePt * PT_TO_MM;
        const color = op.color === "gray" ? GRAY : "black";
        const anchor = op.anchor === "middle" ? ' text-anchor="middle"' : "";
        const rotate = op.rotateDeg
          ? ` transform="rotate(${op.rotateDeg} ${round(op.at[0])} ${round(op.at[1])})"`
          : "";
        parts.push(
          `<text x="${round(op.at[0])}" y="${round(op.at[1])}" font-size="${round(sizeMm)}" fill="${color}"${anchor}${rotate}>${escapeXml(op.text)}</text>`,
        );
        break;
      }
    }
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function strokeW(style: keyof typeof STYLE_WIDTH_PT): string {
  return round(STYLE_WIDTH_PT[style] * PT_TO_MM);
}

function round(v: number): string {
  return (Math.round(v * 1000) / 1000).toString();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
