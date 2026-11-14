// Water and swimming. Game rules only: nothing here draws anything.
//
// Any level can have water: deep pools, each a box seen from above with a
// surface and a floor (`water` on the Level). Deep water is never a fall: a
// hero who drops or walks into it swims. How it goes:
//
//   - In the water a hero floats at the surface, head and shoulders out, and
//     swims the way the stick points, slower than walking.
//   - The move button (Yaarbro's roll, Caputo's pounce) dives: held, the hero
//     swims down. Underwater the stick steers, Jump held swims up, and with
//     neither the hero drifts gently back up to the surface.
//   - At the surface, Jump next to something low enough to reach climbs out
//     onto it. Something no higher than the water (a shore) is walked out on.
//   - The sides of a pool hold a swimmer in: the only way out is to climb.
//   - Underwater the hero holds its breath. The level says for how long
//     (`breath`); with none (Easy) it never runs out. It fills again at the
//     surface. Running out is the same as losing the last heart: a moment
//     down, then back to the last checkpoint with every heart.
//   - Water is never a checkpoint. A hero sent back goes to the last safe bank.
//   - Enemies: nothing reaches a hero whose head is underwater (acorns and
//     dives stop at the surface). At the surface, a swimmer can be hurt like
//     anyone. No enemy goes into the water.

import { MOVE } from './hero';
import { touchesFromAbove, type Solid } from './level';

/** A pool of deep water. Seen from above, a box. */
export interface Water {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Height of the water's top, and of its bottom. */
  surface: number;
  floor: number;
}

/** Distances are metres, times are seconds, speeds are metres per second. */
export const SWIM = {
  /** Feet this far under the surface count as in the water. */
  enter: 0.45,
  /** Floating at the surface, the feet are this far under it: head and shoulders out. */
  float: 1.15,
  /** How tall a swimmer is underwater, stretched out level. */
  underHeight: 0.9,
  /** How far a swimmer's body reaches sideways, for bumping into things. */
  radius: 0.4,
  /** Top swimming speed at the surface, and underwater. */
  surfaceSpeed: 3.6,
  underSpeed: 4.2,
  /** How quickly a swimmer reaches that speed, or slows down. */
  accel: 9,
  /** Down with the move button held, up with Jump held, and drifting up with neither. */
  diveSpeed: 3.4,
  upSpeed: 3.8,
  driftUp: 1.1,
  /** How quickly the up-and-down speed comes to what is asked: water is thick. */
  verticalAccel: 12,
  /** Falling in, the water slows a plunge this hard. */
  plungeDrag: 7,
  /** Feet stay this far above the floor. */
  aboveFloor: 0.1,
  /** Climbing out: the edge's top may be up to this far above the surface, and this close to the swimmer. */
  climbHeight: 1.35,
  climbReach: 0.75,
  /** How long climbing out takes. */
  climbTime: 0.45,
  /** A top no higher than this over the surface is a shore: swimming into it walks the hero out. */
  shoreHeight: 0.35,
  /** Breath fills again at the surface at this many seconds of breath for each second. */
  refill: 8,
} as const;

/** The pool a point is in, seen from above, or null. */
export const waterAt = (waters: readonly Water[] | undefined, x: number, z: number): Water | null => {
  for (const water of waters ?? []) if (x >= water.minX && x <= water.maxX && z >= water.minZ && z <= water.maxZ) return water;
  return null;
};

/** True when a hero's feet at this height are in this pool's water. */
export const inWater = (water: Water, feetY: number): boolean => feetY < water.surface - SWIM.enter && feetY > water.floor - 1;

/** Where a swimmer at (x, z) can climb out: the nearest solid whose top is within reach above the surface, and the spot on it. */
export const climbOut = (
  solids: readonly Solid[],
  water: Water,
  x: number,
  z: number,
  aim: { x: number; z: number } | null,
  maxRise: number = SWIM.climbHeight,
): { solid: Solid; x: number; z: number } | null => {
  let best: { solid: Solid; x: number; z: number; far: number } | null = null;
  for (const s of solids) {
    if (s.gone || s.bounce) continue;
    const rise = s.top - water.surface;
    if (rise < -0.2 || rise > maxRise) continue;
    if (!touchesFromAbove(s, x, z, SWIM.radius + SWIM.climbReach)) continue;
    // The nearest spot on it, a step in from the edge.
    let spotX: number;
    let spotZ: number;
    if (s.shape === 'round') {
      const dx = x - s.x;
      const dz = z - s.z;
      const d = Math.hypot(dx, dz) || 1;
      const r = Math.max(0, s.halfX - MOVE.footRadius - 0.1);
      spotX = s.x + (dx / d) * r;
      spotZ = s.z + (dz / d) * r;
    } else {
      const insetX = Math.min(MOVE.bodyRadius + 0.1, s.halfX);
      const insetZ = Math.min(MOVE.bodyRadius + 0.1, s.halfZ);
      spotX = Math.max(s.x - s.halfX + insetX, Math.min(s.x + s.halfX - insetX, x));
      spotZ = Math.max(s.z - s.halfZ + insetZ, Math.min(s.z + s.halfZ - insetZ, z));
    }
    // With the stick pushed, only an edge the way it points.
    if (aim) {
      const toX = spotX - x;
      const toZ = spotZ - z;
      const d = Math.hypot(toX, toZ);
      if (d > 0.05 && (toX * aim.x + toZ * aim.z) / d < 0.2) continue;
    }
    const far = Math.hypot(spotX - x, spotZ - z);
    if (!best || far < best.far) best = { solid: s, x: spotX, z: spotZ, far };
  }
  return best ? { solid: best.solid, x: best.x, z: best.z } : null;
};
