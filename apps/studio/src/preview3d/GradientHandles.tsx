import { FieldSampler } from "@paper3d/engine";
import type { GradientSublayer, HeightfieldLayer } from "@paper3d/model";
import { Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { useDocStore } from "../state/docStore";
import { getCompositor, useFieldStore } from "../state/fieldStore";

const FROM_COLOR = "#ede6d6";
const TO_COLOR = "#e8a33d";
const HANDLE_LIFT = 2.5;

/**
 * Draggable in-scene endpoints for the active gradient sublayer. Rendered
 * inside the layer's transform group, so all math is in layer-local mm.
 * Dragging scrubs the sublayer's normalized from/to through the same doc
 * update path as the inspector scrubbers — the terrain recomposites live.
 */
export function GradientHandles(props: {
  layer: HeightfieldLayer;
  sublayer: GradientSublayer;
  width: number;
  depth: number;
  group: THREE.Group;
}) {
  const { layer, sublayer, width, depth, group } = props;
  const update = useDocStore((s) => s.update);
  const version = useFieldStore((s) => s.version);

  const sampler = useMemo(
    () => new FieldSampler(getCompositor(layer).field, layer.heightmap.resolution),
    // biome-ignore lint/correctness/useExhaustiveDependencies: version signals in-place field mutation
    [layer, version],
  );

  const surfaceY = (uv: [number, number]) =>
    sampler.sample(uv[0], uv[1]) * layer.heightScale + HANDLE_LIFT;

  const setEnd = (key: "from" | "to", uv: [number, number]) =>
    update((d) => {
      const l = d.layers.find((x) => x.id === layer.id);
      if (l?.kind !== "heightfield") return;
      const s = l.heightmap.sublayers.find((x) => x.id === sublayer.id);
      if (s?.kind === "gradient") s[key] = uv;
    });

  const fromPos: [number, number, number] = [
    sublayer.from[0] * width,
    surfaceY(sublayer.from),
    sublayer.from[1] * depth,
  ];
  const toPos: [number, number, number] = [
    sublayer.to[0] * width,
    surfaceY(sublayer.to),
    sublayer.to[1] * depth,
  ];

  return (
    <group>
      <Line
        points={[fromPos, toPos]}
        color={TO_COLOR}
        lineWidth={1.5}
        dashed
        dashSize={3}
        gapSize={2}
      />
      <Handle
        position={fromPos}
        color={FROM_COLOR}
        width={width}
        depth={depth}
        group={group}
        onDrag={(uv) => setEnd("from", uv)}
      />
      <Handle
        position={toPos}
        color={TO_COLOR}
        width={width}
        depth={depth}
        group={group}
        onDrag={(uv) => setEnd("to", uv)}
      />
    </group>
  );
}

function Handle(props: {
  position: [number, number, number];
  color: string;
  width: number;
  depth: number;
  group: THREE.Group;
  onDrag: (uv: [number, number]) => void;
}) {
  const { position, color, width, depth, group, onDrag } = props;
  // OrbitControls is `makeDefault`, so it's reachable here to pause during drags.
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const drag = useRef<{ planeY: number } | null>(null);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  return (
    <mesh
      position={position}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as unknown as Element).setPointerCapture(e.pointerId);
        drag.current = { planeY: e.point.y };
        if (controls) controls.enabled = false;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        e.stopPropagation();
        // Slide on the horizontal plane the drag started on, then map the
        // world hit back into layer-local UV space.
        const t = (d.planeY - e.ray.origin.y) / e.ray.direction.y;
        if (!Number.isFinite(t) || t <= 0) return;
        const world = e.ray.origin.clone().addScaledVector(e.ray.direction, t);
        const local = group.worldToLocal(world);
        onDrag([clamp01(local.x / width), clamp01(local.z / depth)]);
      }}
      onPointerUp={(e) => {
        drag.current = null;
        (e.target as unknown as Element).releasePointerCapture(e.pointerId);
        if (controls) controls.enabled = true;
      }}
    >
      <sphereGeometry args={[3, 20, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.35}
        roughness={0.4}
      />
    </mesh>
  );
}
