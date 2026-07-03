import * as THREE from "three";

/**
 * Build a solid-looking mesh from a top-height function over a footprint,
 * centred at the footprint centre so a wrapping group's position/rotation/
 * scale directly express the layer transform. `heightAt` returns null where
 * the column is empty (outside an object footprint); a vertical skirt drops to
 * `floor` wherever solid meets empty or the footprint edge.
 */
export function buildSolidGeometry(
  width: number,
  depth: number,
  res: number,
  heightAt: (lx: number, lz: number) => number | null,
  floor = 0,
): THREE.BufferGeometry {
  const cx = width / 2;
  const cz = depth / 2;
  const cols = res + 1;
  const H: (number | null)[] = new Array(cols * cols);
  for (let j = 0; j <= res; j++) {
    for (let i = 0; i <= res; i++) {
      H[j * cols + i] = heightAt((i / res) * width, (j / res) * depth);
    }
  }

  const pos: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number) => {
    pos.push(x - cx, y, z - cz);
    return pos.length / 3 - 1;
  };
  const at = (i: number, j: number) => H[j * cols + i];
  const gx = (i: number) => (i / res) * width;
  const gz = (j: number) => (j / res) * depth;
  const solidCell = (i: number, j: number) =>
    i >= 0 &&
    j >= 0 &&
    i < res &&
    j < res &&
    at(i, j) != null &&
    at(i + 1, j) != null &&
    at(i, j + 1) != null &&
    at(i + 1, j + 1) != null;

  // Top surface.
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      if (!solidCell(i, j)) continue;
      const a = push(gx(i), at(i, j)!, gz(j));
      const b = push(gx(i + 1), at(i + 1, j)!, gz(j));
      const c = push(gx(i + 1), at(i + 1, j + 1)!, gz(j + 1));
      const d = push(gx(i), at(i, j + 1)!, gz(j + 1));
      idx.push(a, c, b, a, d, c);
    }
  }

  // Skirt walls where a solid cell borders empty space or the edge.
  const wall = (x0: number, z0: number, x1: number, z1: number, h0: number, h1: number) => {
    const a = push(x0, floor, z0);
    const b = push(x1, floor, z1);
    const c = push(x1, h1, z1);
    const d = push(x0, h0, z0);
    idx.push(a, b, c, a, c, d);
  };
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      if (!solidCell(i, j)) continue;
      if (!solidCell(i - 1, j)) wall(gx(i), gz(j + 1), gx(i), gz(j), at(i, j + 1)!, at(i, j)!);
      if (!solidCell(i + 1, j))
        wall(gx(i + 1), gz(j), gx(i + 1), gz(j + 1), at(i + 1, j)!, at(i + 1, j + 1)!);
      if (!solidCell(i, j - 1)) wall(gx(i), gz(j), gx(i + 1), gz(j), at(i, j)!, at(i + 1, j)!);
      if (!solidCell(i, j + 1))
        wall(gx(i + 1), gz(j + 1), gx(i), gz(j + 1), at(i + 1, j + 1)!, at(i, j + 1)!);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
