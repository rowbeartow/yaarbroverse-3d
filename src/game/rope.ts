// Rope swings. Game rules only: nothing here draws anything.
//
// Any level can hang a rope (`ropes` on the Level). How it goes:
//
//   - A rope hangs still from a bough, out over a gap, its end a jump's height
//     above the bank before it. A hero in the air who comes within reach of
//     its lower end grabs it, without a button.
//   - Holding on, the hero swings out and back like a weight on a string,
//     always the same width of swing (so it reads the same every time), for
//     as long as they hold on. The stick does nothing.
//   - Jump lets go. The hero flies off the way the rope was moving, with a
//     small kick upward, and steers in the air as after any jump. Let go on
//     the way forward to fly on; let go at the back of the swing and the hero
//     drops where it is.
//   - With help (a level's Easy), letting go at any point in the swing throws
//     the hero onto the place the rope is meant to end on, and the stick
//     cannot spoil the throw.
//   - A rope that was let go cannot be grabbed again until the hero has
//     landed or gone into the water, so letting go never grabs straight back.
//   - A hit knocks the hero off the rope.
//
// A rope's id goes in the level's `route` between the solid before it and the
// solid it ends on, the way a pool's id stands for a swim.

import { MOVE, type HeroName } from './hero';
import type { Solid } from './level';

/** A rope, as a level places it. */
export interface Rope {
  id: string;
  /** Where it is tied: the point it swings from. */
  x: number;
  y: number;
  z: number;
  /** How long it is, from where it is tied to the place a hero holds. */
  length: number;
  /** Which way it carries a hero, seen from above, as a step of length 1. */
  ahead: { x: number; z: number };
  /** The solid a swing is meant to end on. */
  to: string;
  /** Where the foot of the tree or snag that holds it stands, for drawing it. The rules never use it. */
  foot?: { x: number; z: number };
}

/** A rope as it is now. Each game keeps its own. */
export interface RopeState {
  rope: Rope;
  /** How far round it has swung, in radians: 0 hangs straight down, more than 0 is out the way it carries. */
  angle: number;
  /** How fast it is swinging, in radians a second. */
  speed: number;
  /** How wide this swing is: the angle it reaches at each end. */
  swing: number;
}

/** Distances are metres, times are seconds, speeds are metres a second, angles are radians. */
export const ROPE = {
  /** How far a hero's grip is above its feet when it holds on, unless the hero has its own (HANG). */
  hang: 1.5,
  /** A hero whose hands come this close to the lower part of a rope grabs it; with help, this much closer still counts. */
  reach: 1.1,
  helpReach: 0.5,
  /** The part of a rope that can be grabbed: this far up from its end. */
  grip: 2.2,
  /** A hero who takes hold a little way from the rope's end slides to it: this share of what is left, each second, roughly. */
  slide: 9,
  /** How wide a swing is, whatever speed the hero grabbed it at. */
  swing: (52 * Math.PI) / 180,
  /** The pull that swings it. The same as the pull on a jumping hero. */
  gravity: MOVE.gravity,
  /** Letting go adds this much speed upward. */
  kick: 3.5,
  /** With help, a throw onto the landing takes this long for each metre, within these limits. */
  throwPace: 0.11,
  throwShortest: 0.55,
  throwLongest: 1.2,
  /** A swing left to itself dies away to stillness at this share a second, so a rope is still when the next hero comes. */
  settle: 1.2,
} as const;

/**
 * How far a hero's grip is above its feet while it hangs from a rope, in
 * metres: Yaarbro's hands over his head, Caputo's jaw at the top of his body
 * hanging nose up. Measured on the drawn models (src/view/ropes.ts hangs them
 * by the grip), so where the rules have a hero is where it is drawn when it
 * lets go. A hero reaches a rope with its grip, so these also say how high it
 * reaches.
 */
export const HANG: Record<HeroName, number> = { Yaarbro: 2.5, Caputo: 1.4 };

/**
 * How far a hero in the air is from the end of the nearest rope it could
 * take hold of, measured from its grip. For the drawing: a hero reaches out
 * as a rope comes near. Infinity with none.
 */
export const nearestRopeEnd = (hero: { ropes: readonly RopeState[]; x: number; y: number; z: number; hero: HeroName; lastRope: string | null }): number => {
  let nearest = Infinity;
  for (const state of hero.ropes) {
    if (state.rope.id === hero.lastRope) continue;
    const end = handOf(state);
    nearest = Math.min(nearest, Math.hypot(hero.x - end.x, hero.y + HANG[hero.hero] - end.y, hero.z - end.z));
  }
  return nearest;
};

export const newRope = (rope: Rope): RopeState => ({ rope, angle: 0, speed: 0, swing: ROPE.swing });

/** Where a hero holds a rope as it is now: the end of it. */
export const handOf = (state: RopeState): { x: number; y: number; z: number } => {
  const { rope, angle } = state;
  const out = Math.sin(angle) * rope.length;
  return { x: rope.x + rope.ahead.x * out, y: rope.y - Math.cos(angle) * rope.length, z: rope.z + rope.ahead.z * out };
};

/** How fast the end of a rope is moving. */
export const handSpeed = (state: RopeState): { x: number; y: number; z: number } => {
  const { rope, angle, speed } = state;
  const along = Math.cos(angle) * rope.length * speed;
  return { x: rope.ahead.x * along, y: Math.sin(angle) * rope.length * speed, z: rope.ahead.z * along };
};

/**
 * The rope a hero in the air with feet at (x, y, z) can grab now, if any: its
 * hands are within reach of the lower part of one.
 */
export const ropeInReach = (ropes: readonly RopeState[], x: number, y: number, z: number, help: boolean, not: string | null, hang: number = ROPE.hang): RopeState | null => {
  const reach = ROPE.reach + (help ? ROPE.helpReach : 0);
  const handsY = y + hang;
  for (const state of ropes) {
    if (state.rope.id === not) continue;
    const end = handOf(state);
    const { rope } = state;
    // The nearest point to the hands on the part of the rope that can be grabbed.
    const upX = rope.x - end.x;
    const upY = rope.y - end.y;
    const upZ = rope.z - end.z;
    const along = Math.max(0, Math.min(ROPE.grip / rope.length, ((x - end.x) * upX + (handsY - end.y) * upY + (z - end.z) * upZ) / (rope.length * rope.length)));
    const near = Math.hypot(x - end.x - upX * along, handsY - end.y - upY * along, z - end.z - upZ * along);
    if (near <= reach) return state;
  }
  return null;
};

/**
 * A hero takes hold: the rope starts its swing from where it is, forward if
 * the hero was moving the way it carries (or not moving across it at all),
 * and always as wide as a rope's swing is.
 */
export const grab = (state: RopeState, vx: number, vz: number): void => {
  const { rope } = state;
  state.swing = Math.max(ROPE.swing, Math.abs(state.angle) + 0.02);
  // The speed a swing this wide has at this angle.
  const fast = Math.sqrt(Math.max(0, (2 * ROPE.gravity * (Math.cos(state.angle) - Math.cos(state.swing))) / rope.length));
  const forward = vx * rope.ahead.x + vz * rope.ahead.z >= -0.5;
  state.speed = forward ? fast : -fast;
};

/** One step of a rope with a hero on it: a weight on a string, losing nothing. */
export const stepHeld = (state: RopeState, dt: number): void => {
  const { rope } = state;
  state.speed -= (ROPE.gravity / rope.length) * Math.sin(state.angle) * dt;
  state.angle += state.speed * dt;
  // Keep the swing exactly as wide as it should be: small errors would grow or shrink it over many swings.
  if (Math.abs(state.angle) > state.swing) {
    state.angle = Math.sign(state.angle) * state.swing;
    state.speed = 0;
  } else {
    const should = Math.sqrt(Math.max(0, (2 * ROPE.gravity * (Math.cos(state.angle) - Math.cos(state.swing))) / rope.length));
    if (Math.abs(state.speed) > 1e-6) state.speed = Math.sign(state.speed) * should;
    else state.speed = -Math.sign(state.angle || 1) * Math.min(should, 0.05);
  }
};

/** One step of a rope nobody holds: it swings on, dying away to stillness. */
export const stepLoose = (state: RopeState, dt: number): void => {
  if (state.angle === 0 && state.speed === 0) return;
  const { rope } = state;
  state.speed -= (ROPE.gravity / rope.length) * Math.sin(state.angle) * dt;
  state.speed *= Math.exp(-ROPE.settle * dt);
  state.angle += state.speed * dt;
  if (Math.abs(state.angle) < 0.004 && Math.abs(state.speed) < 0.02) {
    state.angle = 0;
    state.speed = 0;
  }
};

/**
 * The speed a hero leaves a rope with. Without help: the way the rope's end
 * was moving, with a kick upward. With help: a throw that comes down on the
 * solid the rope is meant to end on, from wherever in the swing it was let go.
 */
export const letGo = (state: RopeState, feet: { x: number; y: number; z: number }, landing: Solid | undefined, help: boolean): { x: number; y: number; z: number; thrown: boolean } => {
  if (help && landing) {
    // The nearest spot on the landing, a good step in from its edge.
    const inX = Math.min(1.2, landing.halfX * 0.6);
    const inZ = Math.min(1.2, landing.halfZ * 0.6);
    const tx = landing.shape === 'round' ? landing.x : Math.max(landing.x - landing.halfX + inX, Math.min(landing.x + landing.halfX - inX, feet.x));
    const tz = landing.shape === 'round' ? landing.z : Math.max(landing.z - landing.halfZ + inZ, Math.min(landing.z + landing.halfZ - inZ, feet.z));
    const far = Math.hypot(tx - feet.x, tz - feet.z);
    const rise = landing.top - feet.y;
    // Long enough to clear the landing's edge on the way: a higher landing takes a longer throw.
    const time = Math.max(ROPE.throwShortest, Math.min(ROPE.throwLongest, far * ROPE.throwPace + Math.max(0, rise) * 0.22));
    return { x: (tx - feet.x) / time, y: (rise + 0.5 * MOVE.gravity * time * time) / time, z: (tz - feet.z) / time, thrown: true };
  }
  const speed = handSpeed(state);
  return { x: speed.x, y: speed.y + ROPE.kick, z: speed.z, thrown: false };
};
