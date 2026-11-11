// How a hero moves. Game rules only: no browser or drawing code in this folder,
// so the tests can run the whole game without a screen.
//
// Both heroes walk and jump the same. Each has one move of its own, from
// Caputo Mountain: Yaarbro rolls while the move button is held, and Caputo
// pounces when it is pressed.

export type HeroName = 'Yaarbro' | 'Caputo';

export const HEROES: readonly HeroName[] = ['Yaarbro', 'Caputo'];

export const isHeroName = (value: unknown): value is HeroName =>
  value === 'Yaarbro' || value === 'Caputo';

/** What each hero's own move is called on the screen. */
export const MOVE_NAME: Record<HeroName, string> = { Yaarbro: 'Roll', Caputo: 'Pounce' };

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
  /**
   * Yaarbro's roll, while the move button is held: he tucks down and builds
   * up to one and a half times walking speed, more slowly than he walks up to
   * speed, and keeps rolling the way he was going when the stick is let go.
   * In the air the roll gains speed slower still. Rolling faster than a walk
   * is what beats an enemy. (In Caputo Mountain the roll reaches two and a
   * half times walking speed; that is too fast for footing this narrow.)
   */
  rollSpeed: 9,
  rollAccel: 12,
  rollAirAccel: 4,
  /** How tall he is while tucked into a roll. */
  rollHeight: 1,
  /**
   * Caputo's pounce, when the move button is pressed: a burst at about twice
   * walking speed for a fifth of a second, the way the stick points (or the
   * way he faces), flat and with no pull downward while it lasts. From the
   * ground it starts with a small hop. One pounce for each time in the air,
   * and a short rest between two. The proportions are Caputo Mountain's.
   */
  pounceSpeed: 12.8,
  pounceTime: 0.22,
  pounceRest: 0.28,
  pounceHop: 3.5,
  /** When the burst ends he keeps at most this much speed sideways, and this much upward. */
  pounceExitSpeed: 6.8,
  pounceExitRise: 5.9,
  /**
   * Being hurt. These follow Caputo Mountain's forest: a hit costs one heart,
   * throws the hero up and away from what hurt it and takes the controls for
   * a moment, and then nothing can hurt the hero for a while. A level's
   * difficulty sets how far the throw carries (see `knockSpeed`) and
   * stretches or shortens the two protected times.
   */
  hurtKnockUp: 6,
  hurtLock: 0.18,
  hurtProtection: 1.3,
  /** Out of hearts: the hero stays down this long, then goes back to the last safe bank. */
  faintPause: 0.45,
  /** Protection after going back to a safe bank with no hearts left. */
  returnProtection: 1.5,
} as const;

/**
 * How fast a hit throws a hero sideways so that, landing on level ground, it
 * comes down `distance` metres from where it was hit.
 */
export const knockSpeed = (distance: number): number => (distance * MOVE.gravity) / (2 * MOVE.hurtKnockUp);

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
