// What a level is made of, as plain data. A level file builds one of these and
// the game rules in game.ts run it. Nothing here draws anything.
//
// Directions: x is left (-) and right (+), y is up, z is toward the camera (+)
// and away from it (-). Levels run away from the camera, so "forward" is -z.

import type { BossSpot } from './boss';
import type { EnemySpot, EnemyTuning } from './enemy';
import type { Motion, Piece } from './moving';

export type SolidKind = 'bank' | 'log' | 'stump' | 'shelf' | 'mushroom' | 'bough' | 'moss';

/** Something a hero can stand on and bump into. */
export interface Solid {
  id: string;
  kind: SolidKind;
  /** Seen from above: a rectangle, or a circle. */
  shape: 'box' | 'round';
  /** Centre, seen from above. */
  x: number;
  z: number;
  /** Half the size across (x) and along (z). For a circle both are the radius. */
  halfX: number;
  halfZ: number;
  /** Height of the surface you stand on, and of the underside. */
  top: number;
  bottom: number;
  /** Mushroom caps: landing on top launches the hero upward at this speed. */
  bounce?: number;
  /** Mossy banks: standing here makes it the place a fall returns you to. */
  safe?: boolean;
  /** Where on a safe solid a fall returns you to, when that is not its middle: the doorstep of a boss's arena, say. */
  safeAt?: { x: number; z: number };
  /** A piece that moves: tips, crumbles or sways (see moving.ts). Left out, it stays put. */
  motion?: Motion;
  /** A moving piece as it is now. The rules keep this; a level leaves it out. */
  piece?: Piece;
  /** How much the top rises for each metre toward the camera (+z): a tipping log's tilt. `top` is the height at its middle. */
  slopeZ?: number;
  /** A piece that has crumbled away: nothing to stand on or bump into until it grows back. */
  gone?: boolean;
}

/** The height of a solid's top at (x, z): its `top`, unless it is tilted. */
export const topAt = (s: Solid, _x: number, z: number): number => {
  if (!s.slopeZ) return s.top;
  const along = Math.max(-s.halfZ, Math.min(s.halfZ, z - s.z));
  return s.top + s.slopeZ * along;
};

/** The highest point of a solid's top anywhere. */
export const highestTop = (s: Solid): number => s.top + Math.abs(s.slopeZ ?? 0) * s.halfZ;

export interface Leaf {
  x: number;
  y: number;
  z: number;
  /** Touching distance, measured from the middle of the leaf. */
  radius: number;
}

/** One stretch of a level built around one idea, ending on a bank. */
export interface Section {
  name: string;
  solids: string[];
}

export interface Level {
  name: string;
  solids: Solid[];
  /** Where the hero starts. */
  spawn: { x: number; y: number; z: number };
  /** The goal. */
  leaf: Leaf;
  /** Dropping below this height counts as a fall. */
  fallY: number;
  /** Seconds after walking off an edge during which Jump still works. */
  coyoteTime: number;
  /** A hero whose feet are this far below a surface is lifted onto it. */
  ledgeHelp: number;
  /** Hearts a hero starts with, and has again after running out and going back to a safe bank. */
  hearts: number;
  /** Times how long a hero is protected after being hurt, and after going back to a safe bank. */
  protection: number;
  /** How far a hit throws a hero, in metres, measured on level ground. */
  knockback: number;
  /** The enemies, each where it lives. None when left out. */
  enemies?: EnemySpot[];
  /** How this difficulty stretches the enemies' warnings, speed and rest. All 1 when left out. */
  enemyTuning?: EnemyTuning;
  /** The boss the level ends with, if it has one. The goal cannot be taken until it is beaten. */
  boss?: BossSpot;
  /** Ids of the solids in the order a run crosses them, start to goal. */
  route: string[];
  /** The level's sections in order, each with the ids of its solids in route order. */
  sections?: Section[];
  /** Short prompts, each shown the first time the hero stands on that solid. */
  hints?: Record<string, string>;
  /** The line shown when the leaf is reached. */
  goalLine?: string;
}

/** True when a circle of the given radius at (x, z) touches the solid, seen from above. */
export const touchesFromAbove = (s: Solid, x: number, z: number, radius: number): boolean => {
  if (s.shape === 'round') {
    const reach = s.halfX + radius;
    return (x - s.x) ** 2 + (z - s.z) ** 2 <= reach * reach;
  }
  const dx = Math.max(Math.abs(x - s.x) - s.halfX, 0);
  const dz = Math.max(Math.abs(z - s.z) - s.halfZ, 0);
  return dx * dx + dz * dz <= radius * radius;
};

/**
 * If a circle at (x, z) overlaps the solid seen from above, returns the nearest
 * spot just outside it. Returns null when there is no overlap.
 */
export const pushOutside = (
  s: Solid,
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } | null => {
  if (s.shape === 'round') {
    const dx = x - s.x;
    const dz = z - s.z;
    const reach = s.halfX + radius;
    const distance = Math.hypot(dx, dz);
    if (distance >= reach) return null;
    if (distance < 1e-6) return { x: s.x + reach, z: s.z };
    return { x: s.x + (dx / distance) * reach, z: s.z + (dz / distance) * reach };
  }
  const dx = x - s.x;
  const dz = z - s.z;
  const overX = Math.abs(dx) - s.halfX;
  const overZ = Math.abs(dz) - s.halfZ;
  if (overX <= 0 && overZ <= 0) {
    // Centre is inside the rectangle: leave by the nearest side.
    if (overX > overZ) return { x: s.x + Math.sign(dx || 1) * (s.halfX + radius), z };
    return { x, z: s.z + Math.sign(dz || 1) * (s.halfZ + radius) };
  }
  const cornerX = Math.max(overX, 0);
  const cornerZ = Math.max(overZ, 0);
  const distance = Math.hypot(cornerX, cornerZ);
  if (distance >= radius) return null;
  const nearestX = s.x + Math.max(-s.halfX, Math.min(s.halfX, dx));
  const nearestZ = s.z + Math.max(-s.halfZ, Math.min(s.halfZ, dz));
  return {
    x: nearestX + ((x - nearestX) / distance) * radius,
    z: nearestZ + ((z - nearestZ) / distance) * radius,
  };
};

/** The highest surface at or below `y` under the point (x, z), or null over open air. */
export const surfaceBelow = (
  level: Level,
  x: number,
  z: number,
  y: number,
  radius: number,
): Solid | null => {
  let best: Solid | null = null;
  let bestTop = -Infinity;
  for (const s of level.solids) {
    if (s.gone) continue;
    const top = topAt(s, x, z);
    if (top > y + 1e-6) continue;
    if (!touchesFromAbove(s, x, z, radius)) continue;
    if (!best || top > bestTop) {
      best = s;
      bestTop = top;
    }
  }
  return best;
};
