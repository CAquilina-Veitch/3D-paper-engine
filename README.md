# 3D Paper Engine

A Photoshop-style layered editor for designing 3D objects that export as **A4 PDF
cross-section pieces** (sliceforms): print on cardstock, cut the pieces out, and
interlock them via half-depth slots into an egg-crate lattice.


**The pipeline:** layers define a solid → a parametric slicing strategy turns the
solid into flat pieces → pieces get slotted, labeled, and packed onto A4 pages.

## Features (M1 — Terrain-to-PDF)

- **Terrain smart layer** composited from stackable sublayers — procedural noise
  (simplex / perlin / fBm / ridged / voronoi), paintable brush layers (size /
  hardness / opacity, pressure support), and gradients, each with Photoshop-style
  blend modes (add, subtract, multiply, min, max, replace) and strength.
- **Live 3D preview** in two modes: a smooth heightfield while painting, and the
  *actual sliced paper pieces* extruded to paper thickness — what you see is what
  you'll build. Explode slider to inspect the interlock.
- **Parametric cross-sections** per layer: two families with configurable angle,
  spacing, offset, and slot opening direction (egg-crate 90° is just the default
  preset).
- **Print-ready PDF export**: page 1 carries a 100mm calibration ruler, a
  slot-width test comb, assembly instructions, and a labeled top-down assembly
  map; every piece is labeled (A1…B20) with orientation ticks, packed in
  reading order for sane hand-cutting. Slot width = paper thickness + kerf,
  both configurable.
- **Physical sanity warnings**: severed pieces, slots too close to an edge,
  shallow crossings — flagged red in the preview and dashed in the PDF.
- Autosave to the browser, plus `.paper3d` design files (save/open).

## Running

```sh
pnpm install
pnpm dev        # studio at http://localhost:5173
pnpm test       # engine + model test suites
pnpm build      # typecheck + production build
```

## Architecture

pnpm workspace; the geometry core is DOM-free and fully tested.

```
packages/model    document types, zod schema, presets, (de)serialization
packages/engine   pure-TS core: heightmap compositing → column-sampler solids
                  → slicing/slots → A4 layout → SVG/PDF rendering (+ worker)
apps/studio       React + three.js editor UI
```

Key abstraction: every solid is a **column sampler** `(x, z) → y-intervals`,
so heightfields, water layers (M2), boolean layer interactions (M2), and
profile-intersection object layers (M3) all feed the same slicing engine.

## Roadmap

- **M2** — arbitrary family angles (60° diamond, tri-lattice), radial slicing,
  stacked contours, water/fill layers that interleave with the parent terrain,
  layer cut/merge/intersect.
- **M3** — CAD-style object smart layers (draw top/front/side profiles, solid =
  intersection of extrusions), scene placement, cross-layer interlock.
