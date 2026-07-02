import {
  type BlendMode,
  type HeightfieldLayer,
  defaultNoiseSublayer,
  defaultPaintSublayer,
  newHeightfieldLayer,
  newId,
} from "@paper3d/model";
import { SelectField, SliderField } from "../components/fields";
import { useDocStore } from "../state/docStore";
import { useUiStore } from "../state/uiStore";

const BLEND_MODES: readonly BlendMode[] = ["add", "subtract", "multiply", "min", "max", "replace"];
const INTERACTION_GLYPH: Record<string, string> = {
  merge: "＋", // adds onto layers below
  cut: "－", // subtracts from below
  intersect: "∩", // keeps only the overlap
  none: "○", // independent
};

export function LayersPanel() {
  const doc = useDocStore((s) => s.doc);
  const update = useDocStore((s) => s.update);
  const { selectedLayerId, selectedSublayerId, set } = useUiStore();

  const selectedId = selectedLayerId ?? doc.layers[doc.layers.length - 1]?.id;

  const addLayer = () => {
    const layer = newHeightfieldLayer(
      `Layer ${doc.layers.length + 1}`,
      Math.floor(Math.random() * 9999) + 1,
    );
    update((d) => {
      d.layers.push(layer);
    });
    set({ selectedLayerId: layer.id, selectedSublayerId: null });
  };

  // delta +1 moves the layer up the stack (toward the top of the panel).
  const moveLayer = (id: string, delta: number) =>
    update((d) => {
      const i = d.layers.findIndex((l) => l.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.layers.length) return;
      const [l] = d.layers.splice(i, 1);
      d.layers.splice(j, 0, l!);
    });

  const deleteLayer = (id: string) =>
    update((d) => {
      if (d.layers.length > 1) d.layers = d.layers.filter((l) => l.id !== id);
    });

  // Top of the stack renders first, like Photoshop.
  const ordered = doc.layers.slice().reverse();

  return (
    <div className="layers-panel">
      <div className="panel-head">
        <h2>Layers</h2>
        <button type="button" className="add-layer" title="Add a terrain layer" onClick={addLayer}>
          + Layer
        </button>
      </div>
      {ordered.map((layer) => {
        const selected = layer.id === selectedId;
        const stackIndex = doc.layers.findIndex((l) => l.id === layer.id);
        const isBase = stackIndex === 0;
        return (
          <div key={layer.id} className={`layer ${selected ? "selected" : ""}`}>
            <div className="layer-head">
              <input
                type="checkbox"
                checked={layer.visible}
                title="Visible"
                onChange={(e) =>
                  update((d) => {
                    const l = d.layers.find((x) => x.id === layer.id);
                    if (l) l.visible = e.target.checked;
                  })
                }
              />
              <button
                type="button"
                className="layer-name"
                onClick={() => set({ selectedLayerId: layer.id, selectedSublayerId: null })}
              >
                <strong>{layer.name}</strong>
                <span className="layer-mode" title={`Combines with below: ${layer.interaction}`}>
                  {isBase ? "base" : INTERACTION_GLYPH[layer.interaction]}
                </span>
              </button>
              <span className="layer-actions">
                <button
                  type="button"
                  title="Move up"
                  disabled={stackIndex === doc.layers.length - 1}
                  onClick={() => moveLayer(layer.id, 1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={isBase}
                  onClick={() => moveLayer(layer.id, -1)}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="del"
                  title="Delete layer"
                  disabled={doc.layers.length === 1}
                  onClick={() => deleteLayer(layer.id)}
                >
                  ×
                </button>
              </span>
            </div>
            {layer.kind === "heightfield" && selected && (
              <SublayerList layer={layer} selectedSublayerId={selectedSublayerId} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SublayerList(props: { layer: HeightfieldLayer; selectedSublayerId: string | null }) {
  const update = useDocStore((s) => s.update);
  const set = useUiStore((s) => s.set);
  const { layer } = props;

  const mutateLayer = (fn: (l: HeightfieldLayer) => void) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (l?.kind === "heightfield") fn(l);
    });

  // Top of stack first.
  const subs = layer.heightmap.sublayers.slice().reverse();

  return (
    <div className="sublayers">
      {subs.map((sub) => (
        <div
          key={sub.id}
          className={`sublayer ${sub.id === props.selectedSublayerId ? "selected" : ""}`}
        >
          <button
            type="button"
            className="sublayer-title"
            onClick={() => set({ selectedLayerId: layer.id, selectedSublayerId: sub.id })}
          >
            <input
              type="checkbox"
              checked={sub.enabled}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                mutateLayer((l) => {
                  const s = l.heightmap.sublayers.find((x) => x.id === sub.id);
                  if (s) s.enabled = e.target.checked;
                })
              }
            />
            <span>{sub.name}</span>
            <span className="tag">{sub.kind}</span>
            <span
              className="delete"
              title="Delete sublayer"
              onClick={(e) => {
                e.stopPropagation();
                mutateLayer((l) => {
                  l.heightmap.sublayers = l.heightmap.sublayers.filter((x) => x.id !== sub.id);
                });
              }}
            >
              ×
            </span>
          </button>
          {sub.id === props.selectedSublayerId && (
            <div className="sublayer-controls">
              <SelectField
                label="Blend"
                value={sub.blend}
                options={BLEND_MODES}
                onChange={(blend) =>
                  mutateLayer((l) => {
                    const s = l.heightmap.sublayers.find((x) => x.id === sub.id);
                    if (s) s.blend = blend;
                  })
                }
              />
              <SliderField
                label="Strength"
                value={sub.strength}
                min={0}
                max={1}
                onChange={(strength) =>
                  mutateLayer((l) => {
                    const s = l.heightmap.sublayers.find((x) => x.id === sub.id);
                    if (s) s.strength = strength;
                  })
                }
              />
            </div>
          )}
        </div>
      ))}
      <div className="add-row">
        <button
          type="button"
          onClick={() =>
            mutateLayer((l) => {
              l.heightmap.sublayers.push({
                ...defaultNoiseSublayer(Math.floor(Math.random() * 10_000)),
                name: `Noise ${l.heightmap.sublayers.length + 1}`,
              });
            })
          }
        >
          + noise
        </button>
        <button
          type="button"
          onClick={() =>
            mutateLayer((l) => {
              l.heightmap.sublayers.push({
                ...defaultPaintSublayer(l.heightmap.resolution),
                name: `Paint ${l.heightmap.sublayers.length + 1}`,
              });
            })
          }
        >
          + paint
        </button>
        <button
          type="button"
          onClick={() =>
            mutateLayer((l) => {
              l.heightmap.sublayers.push({
                id: newId("sub"),
                name: `Gradient ${l.heightmap.sublayers.length + 1}`,
                enabled: true,
                kind: "gradient",
                blend: "multiply",
                strength: 1,
                shape: "radial",
                from: [0.5, 0.5],
                to: [1, 0.5],
              });
            })
          }
        >
          + gradient
        </button>
      </div>
    </div>
  );
}
