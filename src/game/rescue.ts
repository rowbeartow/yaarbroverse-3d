// A rescue a level can end with (milestone eleven, part two): Walblum, at
// Cocolalla Lake. Game rules only: nothing here draws anything.
//
// The owner's rule (docs/decisions.md, 2026-11-19 and 2026-11-25): the rescue
// is the last thing in the level. Walblum is stranded on a drifting log that
// the monster pike circles. When the pike is beaten he cheers, paddles to the
// dock, climbs up, and waits under the golden leaf. Reaching him and the leaf
// there is one moment, and it ends the level: so the goal cannot be taken
// until he is waiting there, and there is no case where he is sent back.

/** Distances are metres, times are seconds, speeds are metres per second. */
export const RESCUE = {
  /** His log drifts round a circle this wide, once in this many seconds. */
  drift: 0.7,
  driftTime: 16,
  /** How high over the water he sits on it. */
  sits: 0.3,
  /** Freed, he cheers this long before he sets off. */
  cheer: 1.4,
  /** How fast he paddles, how low in the water, and how fast he climbs and walks. */
  paddle: 5.5,
  low: 0.15,
  climb: 2.6,
  walk: 3,
} as const;

/** Where a rescue happens in a level. */
export interface RescueSpot {
  /** Who is rescued: the name the game says. */
  name: string;
  /** The middle of the drift of the log he is stranded on, and how high the water stands. */
  log: { x: number; z: number };
  surface: number;
  /** Where he comes out of the water: a point in it, beside what he climbs. */
  climbAt: { x: number; z: number };
  /** Where he waits, at the goal: the ground under his feet. */
  waitAt: { x: number; y: number; z: number };
}

export type RescuePhase = 'stranded' | 'cheering' | 'paddling' | 'climbing' | 'walking' | 'waiting' | 'rescued';

export interface Rescue {
  spot: RescueSpot;
  phase: RescuePhase;
  /** Seconds in this phase, and seconds since the level began (for the drift). */
  timer: number;
  clock: number;
  /** His feet, and which way he faces (0 faces the camera). */
  x: number;
  y: number;
  z: number;
  facing: number;
}

/** Where his log is `clock` seconds into the level. It goes on drifting when he has left it. */
export const logAt = (spot: RescueSpot, clock: number): { x: number; z: number } => {
  const angle = (clock / RESCUE.driftTime) * Math.PI * 2;
  return { x: spot.log.x + Math.sin(angle) * RESCUE.drift, z: spot.log.z + Math.cos(angle) * RESCUE.drift };
};

export const newRescue = (spot: RescueSpot): Rescue => {
  const at = logAt(spot, 0);
  return { spot, phase: 'stranded', timer: 0, clock: 0, x: at.x, y: spot.surface + RESCUE.sits, z: at.z, facing: 0 };
};

/** True once he waits at the goal: the level can end. */
export const rescueReady = (rescue: Rescue): boolean => rescue.phase === 'waiting' || rescue.phase === 'rescued';

/** The hero has reached him: he is rescued. */
export const completeRescue = (rescue: Rescue): void => {
  rescue.phase = 'rescued';
  rescue.timer = 0;
};

/**
 * Advances the rescue by `dt` seconds. `freed` is whether what kept him
 * stranded is gone (the pike is beaten). Returns the phases he entered.
 */
export const stepRescue = (rescue: Rescue, freed: boolean, hero: { x: number; z: number }, dt: number): RescuePhase[] => {
  const entered: RescuePhase[] = [];
  const { spot } = rescue;
  const enter = (phase: RescuePhase): void => {
    rescue.phase = phase;
    rescue.timer = 0;
    entered.push(phase);
  };
  rescue.timer += dt;
  rescue.clock += dt;
  /** Moves him toward a point seen from above. True when he is there. */
  const go = (x: number, z: number, speed: number): boolean => {
    const dx = x - rescue.x;
    const dz = z - rescue.z;
    const far = Math.hypot(dx, dz);
    if (far > 1e-3) rescue.facing = Math.atan2(dx, dz);
    if (far <= speed * dt) {
      rescue.x = x;
      rescue.z = z;
      return true;
    }
    rescue.x += (dx / far) * speed * dt;
    rescue.z += (dz / far) * speed * dt;
    return false;
  };
  const look = (): void => {
    if (Math.hypot(hero.x - rescue.x, hero.z - rescue.z) > 0.3) rescue.facing = Math.atan2(hero.x - rescue.x, hero.z - rescue.z);
  };

  if (rescue.phase === 'stranded' || rescue.phase === 'cheering') {
    const at = logAt(spot, rescue.clock);
    rescue.x = at.x;
    rescue.z = at.z;
    rescue.y = spot.surface + RESCUE.sits;
    if (rescue.phase === 'stranded') {
      // He keeps his eyes on the hero: they are his only hope.
      look();
      if (freed) enter('cheering');
    } else if (rescue.timer >= RESCUE.cheer) enter('paddling');
  } else if (rescue.phase === 'paddling') {
    rescue.y = spot.surface - RESCUE.low;
    if (go(spot.climbAt.x, spot.climbAt.z, RESCUE.paddle)) enter('climbing');
  } else if (rescue.phase === 'climbing') {
    rescue.y = Math.min(spot.waitAt.y, rescue.y + RESCUE.climb * dt);
    if (rescue.y >= spot.waitAt.y) enter('walking');
  } else if (rescue.phase === 'walking') {
    rescue.y = spot.waitAt.y;
    if (go(spot.waitAt.x, spot.waitAt.z, RESCUE.walk)) enter('waiting');
  } else {
    rescue.x = spot.waitAt.x;
    rescue.y = spot.waitAt.y;
    rescue.z = spot.waitAt.z;
    look();
  }
  return entered;
};
