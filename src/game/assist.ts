// The jump assist: a gentle hand for a jump aimed roughly right (the owner's
// rule for Easy and Normal, 2026-11-16). Game rules only, no drawing.
//
// A keyboard has eight directions, so a player often cannot point a jump
// exactly at a crocodile's back, a stone or a rope. While a hero is in the
// air after a jump (or after letting go of a rope), with the stick or keys
// held roughly toward one of those, this steers the flight onto it:
//
//   - The targets are small footing (crocodiles' backs, logs, stumps,
//     boulders, mushrooms, boughs, moss, shelves) and ropes. Big ground
//     (banks, crags, decks) needs no help.
//   - It looks at where the jump would come down if the player kept the
//     stick as it is. Coming down on something already, it only nudges the
//     landing in from the very edge of a small piece. Coming down in the water
//     or the air, it picks the target nearest that spot, if it is within
//     `reach` metres of it and no more than `angle` degrees off the way the
//     stick points, and steers onto it.
//   - Steering is the hero's own air control, aimed a little differently: no
//     faster than a walk (a roll's speed while rolling) and a little more, and
//     no jump goes further or higher than it could anyway.
//   - Letting go of the stick, or turning it well away, ends it: the player
//     can always choose to miss.
//
// Hard has none: a level leaves `jumpAssist` out.

import { MOVE } from './hero';
import { touchesFromAbove, type Level, type Solid, type SolidKind } from './level';
import { handOf, ROPE, type RopeState } from './rope';

/** How strong a level's jump assist is, on one difficulty. */
export interface JumpAssist {
  /** How far from where the jump would come down a target can be, in metres, and still be steered onto. */
  reach: number;
  /** How far off the way the stick points a target can be, in degrees. */
  angle: number;
}

export const ASSIST = {
  /** The assist brings a landing at least this far in from a small piece's edge, or to its middle when it is smaller than that. */
  inset: 0.45,
  /** The fastest it steers, as a share of the hero's own speed on the stick. */
  most: 1.15,
  /** A stick pushed less than this share of the way is not aiming anywhere. */
  aiming: 0.3,
} as const;

/** Small footing: what the assist steers onto. */
const SMALL: ReadonlySet<SolidKind> = new Set<SolidKind>(['log', 'stump', 'boulder', 'mushroom', 'bough', 'moss', 'shelf']);

export const assistable = (s: Solid): boolean => SMALL.has(s.kind) && !s.gone;

/** Where a hero in the air is, for the assist. */
export interface Flier {
  x: number;
  y: number;
  z: number;
  vy: number;
  /** How far its grip is above its feet (HANG in rope.ts): how high it reaches for a rope. */
  hang: number;
}

/** The spot on a solid's top nearest (x, z), at least `ASSIST.inset` in from its edge (or its middle, when it is small). */
export const insideTop = (s: Solid, x: number, z: number): { x: number; z: number } => {
  if (s.shape === 'round') {
    const room = Math.max(0, s.halfX - ASSIST.inset);
    const dx = x - s.x;
    const dz = z - s.z;
    const far = Math.hypot(dx, dz);
    if (far <= room) return { x, z };
    return { x: s.x + (dx / far) * room, z: s.z + (dz / far) * room };
  }
  const roomX = Math.max(0, s.halfX - ASSIST.inset);
  const roomZ = Math.max(0, s.halfZ - ASSIST.inset);
  return { x: Math.max(s.x - roomX, Math.min(s.x + roomX, x)), z: Math.max(s.z - roomZ, Math.min(s.z + roomZ, z)) };
};

/** Seconds until a hero at height `y` rising at `vy` comes down to `top`, or null if it never gets that high. */
export const timeToFall = (y: number, vy: number, top: number): number | null => {
  const g = MOVE.gravity;
  const under = vy * vy + 2 * g * (y - top);
  if (under < 0) return null;
  const t = (vy + Math.sqrt(under)) / g;
  return t > 0.03 ? t : null;
};

/** What the assist decided on one step: the target it is steering onto (a solid's or a rope's id), and the speed to aim for. */
export interface Steer {
  target: string | null;
  want: { x: number; z: number };
}

/**
 * One step of the assist. `want` is the speed along the ground the stick asks
 * for (as the rules would aim for it without help), `held` the target picked
 * on an earlier step of this jump, `lastRope` the rope just let go of (never
 * a target). Returns the speed to aim for instead, and the target.
 */
export const steerJump = (
  hero: Flier,
  want: { x: number; z: number },
  level: Level,
  ropes: readonly RopeState[],
  lastRope: string | null,
  held: string | null,
  assist: JumpAssist,
): Steer => {
  const speed = Math.hypot(want.x, want.z);
  const none: Steer = { target: null, want };
  if (speed < MOVE.walkSpeed * ASSIST.aiming) return none;
  const way = { x: want.x / speed, z: want.z / speed };
  const cone = Math.cos((assist.angle * Math.PI) / 180);
  const fastest = Math.max(speed, MOVE.walkSpeed) * ASSIST.most;
  /** True when a spot is within the cone of the stick's direction. */
  const ahead = (x: number, z: number): boolean => {
    const dx = x - hero.x;
    const dz = z - hero.z;
    const far = Math.hypot(dx, dz);
    return far < 0.3 || (dx * way.x + dz * way.z) / far >= cone;
  };
  const toward = (x: number, z: number, t: number): { x: number; z: number } => {
    const vx = (x - hero.x) / t;
    const vz = (z - hero.z) / t;
    const fast = Math.hypot(vx, vz);
    return fast > fastest ? { x: (vx / fast) * fastest, z: (vz / fast) * fastest } : { x: vx, z: vz };
  };

  // Where the jump comes down on its own, on whatever is highest under its path there.
  let natural: Solid | null = null;
  for (const s of level.solids) {
    if (s.gone) continue;
    const t = timeToFall(hero.y, hero.vy, s.top);
    if (t === null || (hero.vy <= 0 && s.top > hero.y)) continue;
    if (!touchesFromAbove(s, hero.x + want.x * t, hero.z + want.z * t, MOVE.footRadius)) continue;
    if (!natural || s.top > natural.top) natural = s;
  }
  if (natural && !assistable(natural)) return none;

  // Each target: how far it is from where the jump would come down, and how to steer onto it.
  let best: { id: string; miss: number; want: { x: number; z: number } } | null = null;
  const consider = (id: string, miss: number, steer: { x: number; z: number }): void => {
    // A target picked earlier in this jump is kept unless another is a good deal nearer.
    const score = id === held ? miss - 0.5 : miss;
    if (!best || score < best.miss) best = { id, miss: score, want: steer };
  };
  for (const s of level.solids) {
    if (!assistable(s)) continue;
    if (natural && s !== natural) continue;
    if (hero.vy <= 0 && s.top > hero.y + 0.01) continue;
    const t = timeToFall(hero.y, hero.vy, s.top);
    if (t === null) continue;
    const landX = hero.x + want.x * t;
    const landZ = hero.z + want.z * t;
    const spot = insideTop(s, landX, landZ);
    const miss = Math.hypot(spot.x - landX, spot.z - landZ);
    const edgeMiss = s === natural ? 0 : Math.max(0, miss - ASSIST.inset);
    if (edgeMiss > assist.reach || !ahead(spot.x, spot.z)) continue;
    consider(s.id, edgeMiss, toward(spot.x, spot.z, t));
  }
  // A rope: steer under the end of it, so the hands meet it near the top of the jump.
  if (!natural) {
    for (const state of ropes) {
      if (state.rope.id === lastRope) continue;
      const hand = handOf(state);
      const t = Math.max(hero.vy / MOVE.gravity, 0.15);
      const gripAtTop = hero.y + Math.max(hero.vy, 0) ** 2 / (2 * MOVE.gravity) + hero.hang;
      if (gripAtTop < hand.y - ROPE.reach || gripAtTop > hand.y + ROPE.grip + ROPE.reach) continue;
      const passX = hero.x + want.x * t;
      const passZ = hero.z + want.z * t;
      const miss = Math.hypot(hand.x - passX, hand.z - passZ);
      if (miss > assist.reach + ROPE.reach || !ahead(hand.x, hand.z)) continue;
      consider(state.rope.id, Math.max(0, miss - ROPE.reach), toward(hand.x, hand.z, t));
    }
  }
  const chosen = best as { id: string; miss: number; want: { x: number; z: number } } | null;
  return chosen ? { target: chosen.id, want: chosen.want } : none;
};
