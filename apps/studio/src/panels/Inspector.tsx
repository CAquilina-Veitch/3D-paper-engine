import type { HeightfieldLayer, NoiseAlgo, SlotOpening, Sublayer } from "@paper3d/model";
import { NumberField, Section, SelectField, SliderField } from "../components/fields";
import { useDocStore } from "../state/docStore";
import { useSliceStore } from "../state/engineClient";
import { useUiStore } from "../state/uiStore";

const NOISE_ALGOS: readonly NoiseAlgo[] = ["simplex", "perlin", "fbm", "ridged", "voronoi"];
const OPENINGS: readonly SlotOpening[] = ["top", "bottom"];

export function Inspector() {
  const doc = useDocStore((s) => s.doc);
  const update = useDocStore((s) => s.update);
  const { selectedLayerId, selectedSublayerId } = useUiStore();
  const result = useSliceStore((s) => s.result);

  const layer =
    (doc.layers.find((l) => l.id === selectedLayerId) as HeightfieldLayer | undefined) ??
    (doc.layers[doc.layers.length - 1] as HeightfieldLayer | undefined);
  const sublayer = layer?.heightmap.sublayers.find((s) => s.id === selectedSublayerId);

  const mutateLayer = (fn: (l: HeightfieldLayer) => void) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer?.id);
      if (l?.kind === "heightfield") fn(l);
    });

  return (
    <div className="inspector">
      <h2>Inspector</h2>

      {sublayer && layer && <SublayerInspector layer={layer} sublayer={sublayer} />}

      {layer && (
        <>
          <Section title={`${layer.name} — shape`}>
            <NumberField
              label="Height scale (mm)"
              value={layer.heightScale}
              min={1}
              onChange={(v) => mutateLayer((l) => (l.heightScale = v))}
            />
          </Section>

          <Section title="Cross sections">
            {layer.slicing.families.map((family, i) => (
              <div key={family.id} className="family">
                <strong>Family {"AB"[i] ?? i + 1}</strong>
                <NumberField
                  label="Angle (°)"
                  value={family.angleDeg}
                  step={5}
                  onChange={(v) =>
                    mutateLayer((l) => {
                      l.slicing.families[i]!.angleDeg = v;
                    })
                  }
                />
                <NumberField
                  label="Spacing (mm)"
                  value={family.spacing}
                  min={2}
                  step={0.5}
                  onChange={(v) =>
                    mutateLayer((l) => {
                      l.slicing.families[i]!.spacing = v;
                    })
                  }
                />
                <NumberField
                  label="Offset (mm)"
                  value={family.phase}
                  step={0.5}
                  onChange={(v) =>
                    mutateLayer((l) => {
                      l.slicing.families[i]!.phase = v;
                    })
                  }
                />
                <SelectField
                  label="Slots open"
                  value={family.slotOpening}
                  options={OPENINGS}
                  onChange={(v) =>
                    mutateLayer((l) => {
                      l.slicing.families[i]!.slotOpening = v;
                    })
                  }
                />
              </div>
            ))}
          </Section>
        </>
      )}

      <Section title="World">
        <NumberField
          label="Width (mm)"
          value={doc.world.width}
          min={40}
          step={10}
          onChange={(v) => update((d) => (d.world.width = v))}
        />
        <NumberField
          label="Depth (mm)"
          value={doc.world.depth}
          min={40}
          step={10}
          onChange={(v) => update((d) => (d.world.depth = v))}
        />
      </Section>

      <Section title="Print">
        <NumberField
          label="Paper thickness (mm)"
          value={doc.print.paperThickness}
          min={0.05}
          step={0.05}
          onChange={(v) => update((d) => (d.print.paperThickness = v))}
        />
        <NumberField
          label="Kerf (mm)"
          value={doc.print.kerf}
          min={0}
          step={0.01}
          onChange={(v) => update((d) => (d.print.kerf = v))}
        />
        <NumberField
          label="Base pedestal (mm)"
          value={doc.print.basePedestal}
          min={0}
          step={1}
          onChange={(v) => update((d) => (d.print.basePedestal = v))}
        />
      </Section>

      {result && (
        <Section title="Output">
          <p className="stat">
            {result.model.pieces.length} pieces · {result.layout.pageCount} A4 pages
          </p>
          {warningSummary(result.model).map((w) => (
            <p key={w} className="warning">
              ⚠ {w}
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

function SublayerInspector(props: { layer: HeightfieldLayer; sublayer: Sublayer }) {
  const update = useDocStore((s) => s.update);
  const ui = useUiStore();
  const { layer, sublayer } = props;

  const mutateSub = <T extends Sublayer>(fn: (s: T) => void) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (l?.kind !== "heightfield") return;
      const s = l.heightmap.sublayers.find((x) => x.id === sublayer.id);
      if (s) fn(s as T);
    });

  if (sublayer.kind === "noise") {
    return (
      <Section title={`${sublayer.name} — noise`}>
        <SelectField
          label="Algorithm"
          value={sublayer.algo}
          options={NOISE_ALGOS}
          onChange={(algo) => mutateSub((s: typeof sublayer) => (s.algo = algo))}
        />
        <NumberField
          label="Seed"
          value={sublayer.seed}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.seed = v))}
        />
        <SliderField
          label="Frequency"
          value={sublayer.frequency}
          min={0.5}
          max={20}
          step={0.5}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.frequency = v))}
        />
        <SliderField
          label="Octaves"
          value={sublayer.octaves}
          min={1}
          max={8}
          step={1}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.octaves = v))}
        />
        <SliderField
          label="Lacunarity"
          value={sublayer.lacunarity}
          min={1.5}
          max={4}
          step={0.1}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.lacunarity = v))}
        />
        <SliderField
          label="Gain"
          value={sublayer.gain}
          min={0.1}
          max={0.9}
          step={0.05}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.gain = v))}
        />
      </Section>
    );
  }

  if (sublayer.kind === "paint") {
    return (
      <Section title={`${sublayer.name} — brush`}>
        <SliderField
          label="Size (px)"
          value={ui.brushSize}
          min={2}
          max={128}
          step={1}
          onChange={(v) => ui.set({ brushSize: v })}
        />
        <SliderField
          label="Hardness"
          value={ui.brushHardness}
          min={0}
          max={1}
          onChange={(v) => ui.set({ brushHardness: v })}
        />
        <SliderField
          label="Opacity"
          value={ui.brushOpacity}
          min={0.05}
          max={1}
          onChange={(v) => ui.set({ brushOpacity: v })}
        />
        <SelectField
          label="Direction"
          value={ui.brushSign === 1 ? "raise" : "lower"}
          options={["raise", "lower"] as const}
          onChange={(v) => ui.set({ brushSign: v === "raise" ? 1 : -1 })}
        />
        <p className="hint">Paint in the 2D tab.</p>
      </Section>
    );
  }

  if (sublayer.kind === "gradient") {
    return (
      <Section title={`${sublayer.name} — gradient`}>
        <SelectField
          label="Shape"
          value={sublayer.shape}
          options={["linear", "radial"] as const}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.shape = v))}
        />
        <NumberField
          label="From u"
          value={sublayer.from[0]}
          step={0.05}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.from = [v, s.from[1]]))}
        />
        <NumberField
          label="From v"
          value={sublayer.from[1]}
          step={0.05}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.from = [s.from[0], v]))}
        />
        <NumberField
          label="To u"
          value={sublayer.to[0]}
          step={0.05}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.to = [v, s.to[1]]))}
        />
        <NumberField
          label="To v"
          value={sublayer.to[1]}
          step={0.05}
          onChange={(v) => mutateSub((s: typeof sublayer) => (s.to = [s.to[0], v]))}
        />
      </Section>
    );
  }

  return null;
}

function warningSummary(model: {
  pieces: { warnings: { type: string }[] }[];
  warnings: { detail: string }[];
}): string[] {
  const counts = new Map<string, number>();
  for (const p of model.pieces) {
    for (const w of p.warnings) counts.set(w.type, (counts.get(w.type) ?? 0) + 1);
  }
  const out = [...counts.entries()].map(([type, n]) => `${n}× ${type.replace("-", " ")}`);
  for (const w of model.warnings.slice(0, 3)) out.push(w.detail);
  return out;
}
