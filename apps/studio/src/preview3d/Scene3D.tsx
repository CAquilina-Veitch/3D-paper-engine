import { FieldSampler, objectLocalColumns } from "@paper3d/engine";
import type { Doc, GradientSublayer, SmartLayer } from "@paper3d/model";
import { OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useDocStore } from "../state/docStore";
import { getCompositor, useFieldStore } from "../state/fieldStore";
import { type SceneAppearance, type TransformTool, useUiStore } from "../state/uiStore";
import { GradientHandles } from "./GradientHandles";
import { SlicedPieces } from "./SlicedPieces";
import { buildSolidGeometry } from "./solidMesh";

const TOOLS: { id: TransformTool; glyph: string; label: string }[] = [
  { id: "move", glyph: "↔", label: "Move (G)" },
  { id: "rotate", glyph: "⟳", label: "Rotate (R)" },
  { id: "scale", glyph: "⤢", label: "Scale (S)" },
];

const APPEARANCES: { id: SceneAppearance; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "section", label: "Cross-section" },
];

/**
 * Interactive 3D scene view — a sibling to the cross-section workspaces.
 * Every layer is a solid mesh you can select and move/rotate/scale with a
 * gizmo (Blender-style tools on the left); the transform feeds straight back
 * into the design. The Solid ↔ Cross-section switch only changes how the
 * models are drawn — you can still place and edit layers either way.
 */
export function Scene3D() {
  const doc = useDocStore((s) => s.doc);
  const tool = useUiStore((s) => s.transformTool);
  const appearance = useUiStore((s) => s.sceneAppearance);
  const set = useUiStore((s) => s.set);
  // No fallback: nothing selected = no gizmo, and the inspector shows the scene.
  const selectedId = useUiStore((s) => s.selectedLayerId);
  const isolatedId = useUiStore((s) => s.isolatedLayerId);

  const cx = doc.world.width / 2;
  const cz = doc.world.depth / 2;

  return (
    <div className="scene3d">
      <div className="tool-col">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tool === t.id ? "active" : ""}
            title={t.label}
            onClick={() => set({ transformTool: t.id })}
          >
            {t.glyph}
          </button>
        ))}
      </div>
      <div className="scene-appearance view-modes">
        {APPEARANCES.map((a) => (
          <button
            key={a.id}
            type="button"
            className={appearance === a.id ? "active" : ""}
            onClick={() => set({ sceneAppearance: a.id })}
          >
            {a.label}
          </button>
        ))}
      </div>
      <Canvas
        frameloop="always"
        camera={{ position: [cx + 170, 150, cz + 200], fov: 40, near: 1, far: 4000 }}
        style={{ background: "#102621" }}
        onPointerMissed={() =>
          set({ selectedLayerId: isolatedId ?? null, selectedSublayerId: null })
        }
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[200, 400, 100]} intensity={1.4} />
        <directionalLight position={[-150, 200, -200]} intensity={0.4} />
        <gridHelper
          args={[Math.max(doc.world.width, doc.world.depth) * 2, 20, "#2f5a4f", "#1c3b34"]}
          position={[cx, 0, cz]}
        />
        {doc.layers
          .filter((l) => l.visible && (!isolatedId || l.id === isolatedId))
          .map((layer) => (
            <LayerNode
              key={layer.id}
              layer={layer}
              selected={layer.id === selectedId}
              tool={tool}
              appearance={appearance}
              onSelect={() => set({ selectedLayerId: layer.id, selectedSublayerId: null })}
            />
          ))}
        {appearance === "section" && <SlicedPieces explode={0} />}
        <OrbitControls makeDefault target={[cx, 20, cz]} />
      </Canvas>
    </div>
  );
}

function LayerNode(props: {
  layer: SmartLayer;
  selected: boolean;
  tool: TransformTool;
  appearance: SceneAppearance;
  onSelect: () => void;
}) {
  const { layer, selected, tool, appearance, onSelect } = props;
  const doc = useDocStore((s) => s.doc);
  const update = useDocStore((s) => s.update);
  const version = useFieldStore((s) => s.version);
  const selectedSublayerId = useUiStore((s) => s.selectedSublayerId);
  // When the active thing is a gradient sublayer, the scene shows its
  // draggable endpoints instead of the layer transform gizmo.
  const gradient =
    selected && layer.kind === "heightfield"
      ? layer.heightmap.sublayers.find(
          (s): s is GradientSublayer => s.kind === "gradient" && s.id === selectedSublayerId,
        )
      : undefined;
  // Ref-callback state so TransformControls can attach to the group via its
  // `object` prop (reliable gizmo tracking, incl. when the transform changes
  // from the inspector) rather than wrapping it.
  const [group, setGroup] = useState<THREE.Group | null>(null);
  // biome-ignore lint/suspicious/noExplicitAny: three's TransformControls type isn't exported by drei
  const controlsRef = useRef<any>(null);

  const [cx, cz] =
    layer.kind === "object"
      ? [layer.size.width / 2, layer.size.depth / 2]
      : [doc.world.width / 2, doc.world.depth / 2];

  const geometry = useMemo(
    () => buildLayerGeometry(layer, doc, version),
    [layer, doc.world, version],
  );

  // On gizmo release, read the group's transform back into the layer.
  const commit = () => {
    const g = group;
    if (!g) return;
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (!l) return;
      l.transform.x = g.position.x - cx;
      l.transform.y = g.position.y;
      l.transform.z = g.position.z - cz;
      l.transform.rotY = THREE.MathUtils.radToDeg(g.rotation.y);
      l.transform.scale = Math.max(0.05, g.scale.x);
    });
  };

  // Commit when a gizmo drag finishes (canonical three.js event).
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const onDragChange = (e: { value: boolean }) => {
      if (!e.value) commit();
    };
    c.addEventListener("dragging-changed", onDragChange);
    return () => c.removeEventListener("dragging-changed", onDragChange);
  });

  const t = layer.transform;
  // In cross-section appearance the solid is drawn as a faint ghost so the
  // sliced pieces show through, while still being grabbable by the gizmo.
  const ghost = appearance === "section";
  return (
    <>
      <group
        ref={setGroup}
        position={[t.x + cx, t.y, t.z + cz]}
        rotation={[0, THREE.MathUtils.degToRad(t.rotY), 0]}
        scale={t.scale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color={selected ? "#e8c48d" : layer.kind === "object" ? "#c8a97e" : "#b8a888"}
            roughness={0.9}
            side={THREE.DoubleSide}
            transparent={ghost}
            opacity={ghost ? (selected ? 0.22 : 0.1) : 1}
            depthWrite={!ghost}
            wireframe={ghost}
          />
        </mesh>
        {gradient && group && layer.kind === "heightfield" && (
          <GradientHandles
            layer={layer}
            sublayer={gradient}
            width={doc.world.width}
            depth={doc.world.depth}
            group={group}
          />
        )}
      </group>
      {selected && !gradient && group && (
        <TransformControls
          ref={controlsRef}
          object={group}
          mode={tool === "move" ? "translate" : tool}
          showY
          showX={tool !== "rotate"}
          showZ={tool !== "rotate"}
        />
      )}
    </>
  );
}

function buildLayerGeometry(layer: SmartLayer, doc: Doc, _version: number) {
  if (layer.kind === "object") {
    return buildSolidGeometry(layer.size.width, layer.size.depth, 44, (lx, lz) => {
      const cols = objectLocalColumns(layer, lx, lz);
      return cols.length ? cols[cols.length - 1]!.hi : null;
    });
  }
  const res = layer.heightmap.resolution;
  const sampler = new FieldSampler(getCompositor(layer).field, res);
  const { width, depth } = doc.world;
  return buildSolidGeometry(
    width,
    depth,
    96,
    (lx, lz) => sampler.sample(lx / width, lz / depth) * layer.heightScale,
  );
}
