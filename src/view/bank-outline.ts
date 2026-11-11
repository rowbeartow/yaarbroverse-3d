// The outline of a bank's top, seen from above. No 3D code here, so the tests
// can check it against the rules.
//
// The rules stand a hero on a bank when the middle of its feet is over the
// bank's rectangle, or up to `reach` (the foot radius) past it. The drawn top
// has to tell the truth about that. So its edge wanders in and out, and its
// corners are rounded, but it always stays between the rectangle and that
// furthest standing line: anywhere there is ground drawn, a hero can stand.
// Only the rounded corners fall short of the rectangle, where a hero could
// stand a little past what is drawn, which is the safe way to be wrong.

import { rough } from './noise';

const TAU = Math.PI * 2;

export interface EdgePoint {
  /** Place, measured from the middle of the bank. */
  x: number;
  z: number;
  /** The direction straight out from the edge here. */
  outX: number;
  outZ: number;
  /** Metres round the edge from the start. */
  along: number;
}

/**
 * A point on a rectangle with rounded corners, `across` (0 to 1) of the way
 * round. `corners` are the four corner sizes, starting at the right-hand far
 * corner (+x, +z) and going round with the outline.
 */
export const roundedRect = (
  across: number,
  halfX: number,
  halfZ: number,
  corners: readonly [number, number, number, number],
): EdgePoint => {
  const [c0, c1, c2, c3] = corners;
  const quarter = Math.PI / 2;
  // Start halfway up the right-hand edge and go round toward +z.
  // A line is [length, start x, start z, direction x, direction z];
  // an arc is [length, centre x, centre z, start angle, radius].
  const pieces: Array<['line' | 'arc', number, number, number, number, number]> = [
    ['line', halfZ - c0, halfX, 0, 0, 1],
    ['arc', quarter * c0, halfX - c0, halfZ - c0, 0, c0],
    ['line', 2 * halfX - c0 - c1, halfX - c0, halfZ, -1, 0],
    ['arc', quarter * c1, -(halfX - c1), halfZ - c1, quarter, c1],
    ['line', 2 * halfZ - c1 - c2, -halfX, halfZ - c1, 0, -1],
    ['arc', quarter * c2, -(halfX - c2), -(halfZ - c2), quarter * 2, c2],
    ['line', 2 * halfX - c2 - c3, -(halfX - c2), -halfZ, 1, 0],
    ['arc', quarter * c3, halfX - c3, -(halfZ - c3), quarter * 3, c3],
    ['line', halfZ - c3, halfX, -(halfZ - c3), 0, 1],
  ];
  const total = pieces.reduce((sum, piece) => sum + piece[1], 0);
  const along = (((across % 1) + 1) % 1) * total;
  let left = along;
  for (const [kind, length, a, b, c, d] of pieces) {
    if (left > length) {
      left -= length;
      continue;
    }
    if (kind === 'line') return { x: a + c * left, z: b + d * left, outX: d, outZ: -c, along };
    const angle = c + left / d;
    return { x: a + Math.cos(angle) * d, z: b + Math.sin(angle) * d, outX: Math.cos(angle), outZ: Math.sin(angle), along };
  }
  return { x: halfX, z: 0, outX: 1, outZ: 0, along };
};

export interface BankOutline {
  /** The edge of the drawn top, `across` (0 to 1) of the way round. */
  at(across: number): EdgePoint;
  /** Metres all the way round. */
  length: number;
}

/**
 * The edge of a bank's top. `halfX` and `halfZ` are the bank's rectangle in
 * the rules, `reach` how far past it a hero can stand, and `seed` makes each
 * bank its own shape.
 */
export const bankOutline = (halfX: number, halfZ: number, reach: number, seed: number): BankOutline => {
  // The edge runs down the middle of the strip between the rectangle and the
  // furthest standing line, and wanders by a little less than half its width.
  const middle = reach / 2;
  const room = Math.max(0, middle - 0.015);
  // Four corners, each rounded by a different amount.
  const pick = (n: number): number => 0.5 + 0.5 * Math.sin(seed * 12.9898 + n * 78.233);
  const most = Math.min(halfX, halfZ) * 0.5;
  const corners = [0, 1, 2, 3].map((n) => Math.min(most, 0.85 + 1.0 * pick(n))) as [number, number, number, number];
  const length = roundedRect(0.999999, halfX + middle, halfZ + middle, corners).along / 0.999999;
  // The wander is read off a circle of noise, so it joins up where the outline ends.
  const ring = length / TAU;
  return {
    length,
    at(across) {
      const edge = roundedRect(across, halfX + middle, halfZ + middle, corners);
      const angle = across * TAU;
      const u = Math.cos(angle) * ring;
      const v = Math.sin(angle) * ring;
      const wander = 0.2 * rough(u * 0.5 + seed, v * 0.5, 2.2) + 0.07 * rough(u * 1.7, v * 1.7 + seed, 7.1);
      const shift = Math.min(room, Math.max(-room, wander));
      return { ...edge, x: edge.x + edge.outX * shift, z: edge.z + edge.outZ * shift };
    },
  };
};

/** The seed that gives a bank its own shape: where it is in the level. */
export const bankSeed = (x: number, z: number): number => x * 0.7 + z * 0.13;
