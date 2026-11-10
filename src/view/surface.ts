// One building block for smooth scenery: a sheet of points, optionally wrapped
// round into a tube. Trunks, stumps, logs, rock walls, mushroom caps and the
// ground are all made by saying where each point of the sheet goes.

import { BufferGeometry, Float32BufferAttribute } from 'three';

/** One point of the sheet, filled in by the caller. */
export interface SurfacePoint {
  x: number;
  y: number;
  z: number;
  /** Where this point sits on the surface picture (texture), in tiles. */
  s: number;
  t: number;
  /** 0 to 1: how much moss grows here (used by materials made with moss). */
  moss: number;
  /** 0 to 1: how much the wind moves this point (used by swaying materials). */
  sway: number;
}

export interface SurfaceOptions {
  /** Join the last column back to the first, making a tube. */
  closed?: boolean;
  /** Turn the faces the other way round. */
  flip?: boolean;
}

/**
 * Builds a sheet of (rows + 1) by (cols + 1) points. `place` is called for each
 * with `across` (0 to 1 along a row, the way round a tube) and `down` (0 to 1
 * from the first row to the last). The surface is shaded smooth.
 *
 * With the default facing, a tube whose `across` runs x = cos, z = sin and whose
 * `down` runs downward faces outward.
 */
export const surface = (
  rows: number,
  cols: number,
  place: (across: number, down: number, point: SurfacePoint, row: number, col: number) => void,
  options: SurfaceOptions = {},
): BufferGeometry => {
  const count = (rows + 1) * (cols + 1);
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const moss = new Float32Array(count);
  const sway = new Float32Array(count);
  const point: SurfacePoint = { x: 0, y: 0, z: 0, s: 0, t: 0, moss: 0, sway: 0 };
  let usesMoss = false;
  let usesSway = false;
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const i = row * (cols + 1) + col;
      point.moss = 0;
      point.sway = 0;
      // On a tube the last column is the first again, at the same place.
      place(col / cols, row / rows, point, row, options.closed && col === cols ? 0 : col);
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      uvs[i * 2] = point.s;
      uvs[i * 2 + 1] = point.t;
      moss[i] = point.moss;
      sway[i] = point.sway;
      usesMoss ||= point.moss !== 0;
      usesSway ||= point.sway !== 0;
    }
  }
  const index: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      if (options.flip) index.push(a, c, b, b, c, d);
      else index.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  if (usesMoss) geometry.setAttribute('moss', new Float32BufferAttribute(moss, 1));
  if (usesSway) geometry.setAttribute('sway', new Float32BufferAttribute(sway, 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  if (options.closed) {
    // The seam: first and last column are the same place, so share their shading.
    const normal = geometry.getAttribute('normal');
    for (let row = 0; row <= rows; row += 1) {
      const first = row * (cols + 1);
      const last = first + cols;
      const x = normal.getX(first) + normal.getX(last);
      const y = normal.getY(first) + normal.getY(last);
      const z = normal.getZ(first) + normal.getZ(last);
      const length = Math.hypot(x, y, z) || 1;
      normal.setXYZ(first, x / length, y / length, z / length);
      normal.setXYZ(last, x / length, y / length, z / length);
    }
  }
  return geometry;
};

/** A smooth curve through the given points (Catmull-Rom), at `t` from 0 to 1. */
export const through = (points: ReadonlyArray<readonly [number, number]>, t: number): [number, number] => {
  const scaled = Math.min(Math.max(t, 0), 1) * (points.length - 1);
  const i = Math.min(Math.floor(scaled), points.length - 2);
  const f = scaled - i;
  const p0 = points[Math.max(i - 1, 0)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(i + 2, points.length - 1)];
  const at = (k: 0 | 1): number =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * f +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f);
  return [at(0), at(1)];
};
