import { FieldSampler } from "@paper3d/engine";
import type { HeightfieldLayer } from "@paper3d/model";
import { useMemo } from "react";
import * as THREE from "three";
import { useDocStore } from "../state/docStore";
import { getCompositor, useFieldStore } from "../state/fieldStore";
import { useUiStore } from "../state/uiStore";

const SEGMENTS = 128;

/** Live heightfield mesh — zero-latency preview while painting. */
export function SmoothMesh() {
  const doc = useDocStore((s) => s.doc);
  const version = useFieldStore((s) => s.version);

  const selectedId = useUiStore((s) => s.selectedLayerId);
  const isolatedId = useUiStore((s) => s.isolatedLayerId);
  const layers = doc.layers.filter(
    (l): l is HeightfieldLayer => l.kind === "heightfield" && l.visible,
  );
  // Show the layer being edited; fall back to the top visible heightfield.
  const layer =
    layers.find((l) => l.id === (selectedId ?? isolatedId)) ?? layers[layers.length - 1];

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (!layer) return geo;
    const sampler = new FieldSampler(getCompositor(layer).field, layer.heightmap.resolution);
    const { width, depth } = doc.world;
    const n = SEGMENTS + 1;
    const positions = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = i / SEGMENTS;
        const v = j / SEGMENTS;
        const idx = (j * n + i) * 3;
        positions[idx] = u * width;
        positions[idx + 1] = sampler.sample(u, v) * layer.heightScale;
        positions[idx + 2] = v * depth;
      }
    }
    const indices: number[] = [];
    for (let j = 0; j < SEGMENTS; j++) {
      for (let i = 0; i < SEGMENTS; i++) {
        const a = j * n + i;
        indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
    // biome-ignore lint/correctness/useExhaustiveDependencies: version signals in-place field mutation
  }, [layer, doc.world, version]);

  if (!layer) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#b8a888" roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}
