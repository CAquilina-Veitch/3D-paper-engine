import type { Piece } from "@paper3d/engine";
import { useMemo } from "react";
import * as THREE from "three";
import { useDocStore } from "../state/docStore";
import { useSliceStore } from "../state/engineClient";

const FAMILY_COLORS = ["#e8a33d", "#4d9de0", "#7bc86c", "#c678dd"];
const WARNING_COLOR = "#e05252";

/**
 * The actual sliced pieces, extruded to paper thickness and stood on their
 * planes — this preview IS what you'll build.
 */
export function SlicedPieces(props: { explode: number }) {
  const result = useSliceStore((s) => s.result);
  const thickness = useDocStore((s) => s.doc.print.paperThickness);

  const pieces = result?.model.pieces ?? [];
  return (
    <group>
      {pieces.map((piece) => (
        <PieceMesh
          key={piece.id}
          piece={piece}
          thickness={Math.max(thickness, 0.4)}
          explode={props.explode}
        />
      ))}
    </group>
  );
}

function PieceMesh(props: { piece: Piece; thickness: number; explode: number }) {
  const { piece, thickness } = props;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape(piece.outline.map(([u, v]) => new THREE.Vector2(u, v)));
    for (const hole of piece.holes) {
      shape.holes.push(new THREE.Path(hole.map(([u, v]) => new THREE.Vector2(u, v))));
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness / 2);
    return geo;
  }, [piece, thickness]);

  const matrix = useMemo(() => {
    const dir = new THREE.Vector3(piece.plane.dir[0], 0, piece.plane.dir[1]);
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(dir, up);
    const m = new THREE.Matrix4().makeBasis(dir, up, normal);
    m.setPosition(piece.plane.origin[0], 0, piece.plane.origin[1]);
    return m;
  }, [piece]);

  const hasWarning = piece.warnings.length > 0;
  const color = hasWarning
    ? WARNING_COLOR
    : (FAMILY_COLORS[piece.familyIndex] ?? FAMILY_COLORS[0]!);

  // Lift alternate families apart so the interlock reads clearly.
  const lift = piece.familyIndex % 2 === 1 ? props.explode * 60 : 0;

  return (
    <group position={[0, lift, 0]}>
      <mesh geometry={geometry} matrixAutoUpdate={false} matrix={matrix}>
        <meshStandardMaterial
          color={color}
          roughness={0.85}
          side={THREE.DoubleSide}
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
  );
}
