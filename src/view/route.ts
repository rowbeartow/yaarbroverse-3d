// Where the route runs, worked out from the level's solids, so the forest can
// be laid out around a route of any length and shape, and so only the stretch
// near the hero is drawn. No 3D code here, so the tests can check it.

import type { Level } from '../game/level';

/** Mist hides everything this far from the camera (the far end of the fog), in metres. */
export const MIST_NEAR = 42;
export const MIST_FAR = 165;

/** The scenery is built in stretches of this many metres along the route. */
export const STRETCH = 36;

/**
 * How far ahead of the hero, and how far back toward the camera, a stretch of
 * scenery is still drawn. Ahead is where the mist has closed to within a
 * twentieth of solid (152 m from the camera, which sits 12 m behind the hero):
 * nothing past it can be told from mist. Behind covers the camera and the
 * trees whose shadows fall into view.
 */
export const DRAW_AHEAD = 140;
export const DRAW_BEHIND = 48;

/**
 * Past this distance ahead of the hero the mist is a third closed and things
 * are small on the screen: trees are drawn with their lighter crowns, and
 * ferns, grass and the boulders and roots on the sides of banks are left out.
 */
export const DETAIL_AHEAD = 85;

/** True when something whose near end is at z `near` is close enough for full detail. */
export const inDetail = (near: number, heroZ: number): boolean => near >= heroZ - DETAIL_AHEAD;

/**
 * True when something lying between `near` and `far` (z values, `far` the
 * smaller: the route runs toward -z) is close enough to the hero to be drawn.
 */
export const inView = (near: number, far: number, heroZ: number): boolean =>
  far <= heroZ + DRAW_BEHIND && near >= heroZ - DRAW_AHEAD;

export interface Route {
  /** z of the near end (by the camera at the start) and the far end. */
  near: number;
  far: number;
  /** The middle of the route at a distance along it, eased so it never jumps sideways. */
  centre(z: number): number;
  /** The leftmost and rightmost edge of anything to stand on within a few metres of z. */
  sides(z: number): { left: number; right: number };
  /** Roughly how high the route is at z. */
  height(z: number): number;
}

export const routeOf = (level: Level): Route => {
  const near = Math.max(...level.solids.map((s) => s.z + s.halfZ));
  const far = Math.min(...level.solids.map((s) => s.z - s.halfZ));
  // One sample every 2 m: the solids over that spot, a few metres either way.
  const step = 2;
  const count = Math.ceil((near - far) / step) + 1;
  const reach = 6;
  const left: number[] = [];
  const right: number[] = [];
  const middle: number[] = [];
  const tops: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const z = near - i * step;
    let lo = Infinity;
    let hi = -Infinity;
    let top = -Infinity;
    for (const s of level.solids) {
      if (s.z - s.halfZ > z + reach || s.z + s.halfZ < z - reach) continue;
      lo = Math.min(lo, s.x - s.halfX);
      hi = Math.max(hi, s.x + s.halfX);
      top = Math.max(top, s.top);
    }
    // Over a long gap nothing is close: carry on from the last sample.
    left.push(Number.isFinite(lo) ? lo : (left[i - 1] ?? 0));
    right.push(Number.isFinite(hi) ? hi : (right[i - 1] ?? 0));
    tops.push(Number.isFinite(top) ? top : (tops[i - 1] ?? 0));
    middle.push((left[i] + right[i]) / 2);
  }
  /** A list eased over 12 m either way, so the forest bends gently where the route turns. */
  const eased = (list: number[]): number[] =>
    list.map((_, i) => {
      let sum = 0;
      let weight = 0;
      for (let k = -6; k <= 6; k += 1) {
        const value = list[Math.min(Math.max(i + k, 0), list.length - 1)];
        const w = 7 - Math.abs(k);
        sum += value * w;
        weight += w;
      }
      return sum / weight;
    });
  const easedMiddle = eased(middle);
  const easedTops = eased(tops);
  const at = (list: number[], z: number): number => {
    const place = Math.min(Math.max((near - z) / step, 0), list.length - 1);
    const i = Math.min(Math.floor(place), list.length - 2);
    if (i < 0) return list[0];
    const share = place - i;
    return list[i] + (list[i + 1] - list[i]) * share;
  };
  const nearest = (list: number[], z: number): number =>
    list[Math.min(Math.max(Math.round((near - z) / step), 0), list.length - 1)];
  return {
    near,
    far,
    centre: (z) => at(easedMiddle, z),
    sides: (z) => ({ left: nearest(left, z), right: nearest(right, z) }),
    height: (z) => at(easedTops, z),
  };
};
