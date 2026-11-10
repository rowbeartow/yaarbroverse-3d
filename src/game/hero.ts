// How a hero moves. Game rules only: no browser or drawing code in this folder,
// so the tests can run the whole game without a screen.
//
// Both heroes share these numbers for now. They look different and play the same.

export type HeroName = 'Yaarbro' | 'Caputo';

export const HEROES: readonly HeroName[] = ['Yaarbro', 'Caputo'];

export const isHeroName = (value: unknown): value is HeroName =>
  value === 'Yaarbro' || value === 'Caputo';

/** The game advances in fixed steps of this many seconds, whatever the screen's frame rate. */
export const STEP = 1 / 60;

/** Distances are metres, times are seconds, speeds are metres per second. */
export const MOVE = {
  /** Top walking speed. */
  walkSpeed: 6,
  /** How quickly a hero reaches walking speed on the ground, and in the air. */
  groundAccel: 40,
  airAccel: 20,
  /** Downward pull, and the fastest a hero can fall. */
  gravity: 30,
  maxFallSpeed: 25,
  /** Upward speed of a jump. With this gravity a full jump rises about 2 m. */
  jumpSpeed: 11,
  /** Letting go of Jump early drops the upward speed to this, for a short hop. */
  jumpCutSpeed: 4,
  /** A Jump press this soon before landing still counts. */
  jumpBuffer: 0.12,
  /** Body size used for bumping into things. */
  bodyRadius: 0.4,
  bodyHeight: 1.6,
  /** How far past an edge the feet can be and still stand. */
  footRadius: 0.3,
  /** After a fall, the hero stands still on the safe bank for this long. */
  returnPause: 0.7,
} as const;

/** Height of a full jump, from the numbers above. */
export const fullJumpHeight = (): number => (MOVE.jumpSpeed * MOVE.jumpSpeed) / (2 * MOVE.gravity);

/**
 * How far a running full jump carries, measured edge to edge, when the landing
 * spot is `rise` metres higher (negative for lower) than the take-off spot.
 * Returns 0 when the landing spot is too high to reach at all.
 */
export const jumpReach = (rise = 0): number => {
  const { jumpSpeed: v, gravity: g, walkSpeed, footRadius } = MOVE;
  const under = v * v - 2 * g * rise;
  if (under < 0) return 0;
  const airTime = (v + Math.sqrt(under)) / g;
  return walkSpeed * airTime + 2 * footRadius;
};
