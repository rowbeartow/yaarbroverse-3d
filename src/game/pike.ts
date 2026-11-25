// The monster pike of Cocolalla Lake (milestone eleven, part two): a boss
// fought first on the fishing line and then in the water. Game rules only:
// nothing here draws anything. `game.ts` steps it; `fishing.ts` runs the tug
// of war, because the first half of the fight is fishing.
//
// The owner's design (docs/decisions.md, 2026-11-19):
//   - It starts as fishing. The monster circles a drifting log out in the
//     fishing water. A cast at its shadow hooks it.
//   - On the line it is a tug of war: reel while it tires, let the line run
//     while it thrashes, or the line snaps. Every `pull` metres of line won
//     takes one of its pips. A snapped line lets it go, at full health.
//   - When half its pips are gone it drags the hero off the jetty into the
//     lake, and the second half is in the water. It circles, and charges a
//     swimmer. The hero climbs onto the floating log. Then it comes up beside
//     the log to snap: jaws open (the tell), a snap at where the hero stood,
//     and then it lies spent at the surface. That is the opening: a landing
//     on it, Yaarbro's roll or Caputo's pounce takes a pip.
//   - With no pips left it is beaten and sinks. Until then the level's goal
//     cannot be taken.
//   - The regen rule: a hero sent back to a safe bank finds it back where it
//     began, at full health, and the fight starts over from the cast.
//   - On Easy nothing needs precise timing: the numbers are the level's, in
//     its `difficulty.ts`.
//
// A hero who climbs out of the water somewhere else (the dock's steps) is
// left alone: it only goes for a hero in its water within `range` of its
// log, or on the floating log.

/** Distances are metres, times are seconds, speeds are metres per second. */
export const PIKE = {
  /** Its body for touching, as an upright can around its middle; and how long it is drawn, nose to tail. */
  radius: 1.3,
  halfHeight: 0.45,
  length: 4.6,
  /** How deep its middle lies while it circles, and while it charges with its fin out of the water. */
  cruiseDepth: 1.3,
  chargeDepth: 0.4,
  /** How far its middle stands out of the water when it comes up to snap, and while it lies spent. */
  upHeight: 0.05,
  /** How fast it circles its log, how fast it changes depth, and how fast it gets back to its circle. */
  cruise: 2.6,
  rise: 3.2,
  regroup: 6,
  /** The moment in which it drags the hero in: it does nothing else. */
  drag: 1.6,
  /** How fast a dragged hero is pulled out over the water, and up. */
  dragOut: 9,
  dragUp: 7,
  /** It only goes for a hero within this far of its log. */
  range: 24,
  /** A charge goes this far past where the hero was. */
  chargePast: 4,
  /** It comes up this far out from the side of the floating log, swimming there this fast. */
  beside: 1.5,
  approach: 9,
  /** A snap takes this long, and reaches a hero whose feet are less than this far over the water. */
  snap: 0.3,
  snapHigh: 2.1,
  /** A hit staggers it for this long. */
  stagger: 1.1,
  /** A hit shoves it this far, over this long. */
  knock: 0.6,
  knockTime: 0.16,
  /** A landing on it throws the hero up at this speed; one that does not count also throws them aside at this speed. */
  rebound: 11.5,
  bounceOff: 5,
  /** After a hit the hero cannot be hurt for this long; once it is beaten, for this long. */
  strikeProtection: 1,
  victoryProtection: 3,
  /** A hero has to be falling at least this fast for landing on it to count. */
  stompSpeed: 0.8,
  /** A beaten pike has sunk out of sight this long after it is beaten. */
  fade: 3,
  /** After the hero is sent back, or it gets off the line, it takes no lure for this long. */
  sulk: 2,
} as const;

/** The monster pike's numbers for one difficulty. They live in the level's `difficulty.ts`. */
export interface PikeNumbers {
  /** Its pips. Half (rounded up) go on the line, the rest in the water. */
  health: number;
  /** The line: metres of line to win for each pip. */
  pull: number;
  /** The line: seconds it tires for between thrashes, seconds a thrash lasts, and how fast it takes line while it thrashes. */
  calm: number;
  thrash: number;
  run: number;
  /** The line: how much of the usual reeling speed its weight leaves. */
  heavy: number;
  /** The water: seconds it circles between one attack and the next. */
  wait: number;
  /** A charge at a swimmer: seconds of warning (its fin comes up and it turns), and how fast it comes. */
  chargeTell: number;
  chargeSpeed: number;
  /** Beside the log: seconds its jaws stand open before the snap, and how far from where it aimed the snap reaches. */
  snapTell: number;
  snapReach: number;
  /** Seconds it lies spent at the surface after a snap. This is the opening. */
  rest: number;
  /** True: only a hit while it lies spent counts. False: a hit counts from the moment its jaws open. */
  guarded: boolean;
  /** Whether a line shows where a charge will go and a ring where a snap will land. The rules do not use this. */
  aimLine: boolean;
}

/** Where the monster pike lives in a level. */
export interface PikeSpot {
  id: string;
  /** The name on its health bar. */
  name: string;
  /** The pool it lives in, and how high that water stands. */
  water: string;
  surface: number;
  /** The drifting log it circles, and how far out it circles. */
  home: { x: number; z: number };
  circle: number;
  /** The floating log a hero fights it from: a solid of the level. */
  log: string;
  /** Which way a hooked pike drags the hero: a step of length 1 seen from above. */
  ahead: { x: number; z: number };
  /** The water it keeps to, seen from above. */
  patch: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Enemies of the level that take fright and run off when it is hooked (the scouts on its dock), by id: the fight is the pike's alone. */
  scares?: string[];
  numbers: PikeNumbers;
}

export type PikePhase =
  /** Circling its log, to be fished for. */
  | 'lurking'
  /** On the line: fishing.ts runs the tug of war. */
  | 'hooked'
  /** Dragging the hero into the lake. */
  | 'dragging'
  /** The water half: circling between attacks. */
  | 'circling'
  /** Its fin is up and it has fixed its line on a swimmer. */
  | 'charge-tell'
  | 'charge'
  /** Swimming to the side of the log. */
  | 'rising'
  /** Up beside the log, jaws open: the tell. */
  | 'gape'
  | 'snap'
  /** Spent at the surface: the opening. */
  | 'rest'
  | 'stagger'
  | 'beaten';

export interface Pike {
  spot: PikeSpot;
  /** Its middle. */
  x: number;
  y: number;
  z: number;
  /** Which way it faces, as an angle seen from above (0 faces the camera). */
  facing: number;
  phase: PikePhase;
  /** Seconds in this phase. */
  timer: number;
  health: number;
  /** Where round its circle it is, in radians. */
  angle: number;
  /** Seconds it has circled with a hero to go for, since its last attack. */
  waited: number;
  /** Where a charge starts and ends, or where it comes up and where its snap is aimed: fixed when the tell begins. */
  from: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** The shove of a hit still to be travelled. */
  shove: { x: number; z: number; left: number };
  /** Counts down: it takes no lure until this is zero. */
  sulk: number;
  /** Fights begun so far (times it has been hooked). */
  fights: number;
  /** True while the fishing moves it: a lure has its eye, or it is on the line (see game.ts). */
  led: boolean;
}

/** What one step of the pike did. */
export interface PikeOutcome {
  /** Phases it entered this step. */
  entered: PikePhase[];
  /** A hit landed: how. */
  struck?: 'roll' | 'pounce' | 'stomp';
  /** A landing on it did not count, and bounced off. */
  blocked?: boolean;
  /** It hurt the hero, from here. */
  hurt?: { x: number; z: number };
}

/** What the pike needs to know about the hero. The game itself fits this. */
export interface PikeHero {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bodyHeight: number;
  striking: boolean;
  pouncing: number;
}

/** Where the hero is, for the pike: in its water, on the floating log, or anywhere else. */
export type PikeSees = 'water' | 'log' | 'away';

/** How many of its pips go on the line. */
export const linePips = (numbers: PikeNumbers): number => Math.ceil(numbers.health / 2);

const circlePoint = (spot: PikeSpot, angle: number): { x: number; z: number } => ({ x: spot.home.x + Math.sin(angle) * spot.circle, z: spot.home.z + Math.cos(angle) * spot.circle });

export const newPike = (spot: PikeSpot): Pike => {
  const at = circlePoint(spot, 0);
  return {
    spot, x: at.x, y: spot.surface - PIKE.cruiseDepth, z: at.z, facing: Math.PI / 2, phase: 'lurking', timer: 0, health: spot.numbers.health,
    angle: 0, waited: 0, from: { x: at.x, y: 0, z: at.z }, target: { x: at.x, y: 0, z: at.z }, shove: { x: 0, z: 0, left: 0 }, sulk: 0, fights: 0, led: false,
  };
};

/**
 * The regen rule, and a line that snapped: a pike that is not beaten is back
 * circling its log at full health, to be fished for again. Returns true when
 * it had been damaged. A beaten pike stays beaten.
 */
export const resetPike = (pike: Pike): boolean => {
  if (pike.phase === 'beaten') return false;
  const damaged = pike.health < pike.spot.numbers.health;
  pike.health = pike.spot.numbers.health;
  pike.phase = 'lurking';
  pike.timer = 0;
  pike.waited = 0;
  pike.shove = { x: 0, z: 0, left: 0 };
  pike.sulk = PIKE.sulk;
  pike.led = false;
  return damaged;
};

/** True while the fight is on: hooked and not yet won. */
export const pikeFighting = (pike: Pike): boolean => pike.phase !== 'lurking' && pike.phase !== 'beaten';

/** True while it is up at the surface, where it can be reached. */
export const pikeUp = (pike: Pike): boolean => pike.phase === 'gape' || pike.phase === 'snap' || pike.phase === 'rest';

/** True while a hit would count. */
export const pikeOpen = (pike: Pike): boolean => pike.phase === 'rest' || (!pike.spot.numbers.guarded && pike.phase === 'gape');

/** Its body, as an upright can. */
export const pikeBody = (pike: Pike): { bottom: number; top: number; radius: number } => ({ bottom: pike.y - PIKE.halfHeight, top: pike.y + PIKE.halfHeight, radius: PIKE.radius });

/** It is hooked: the tug of war begins (fishing.ts runs it). */
export const hookPike = (pike: Pike): void => {
  pike.phase = 'hooked';
  pike.timer = 0;
  pike.fights += 1;
};

/** It has lost its pips on the line and drags the hero in: the water half begins. */
export const dragPike = (pike: Pike): void => {
  pike.phase = 'dragging';
  pike.timer = 0;
  pike.waited = 0;
};

/**
 * A hit on it: one pip. Returns the phase it entered. The caller has checked
 * `pikeOpen`.
 */
const hit = (pike: Pike, alongX: number, alongZ: number): PikePhase => {
  pike.health = Math.max(0, pike.health - 1);
  const along = Math.hypot(alongX, alongZ);
  pike.shove = along > 1e-6 ? { x: (alongX / along) * PIKE.knock, z: (alongZ / along) * PIKE.knock, left: PIKE.knockTime } : { x: 0, z: 0, left: 0 };
  pike.phase = pike.health <= 0 ? 'beaten' : 'stagger';
  pike.timer = 0;
  return pike.phase;
};

/**
 * A strike from a distance (Walblum's kick, Claw Slash: see ability.ts). It
 * counts exactly when a landing on it would. Returns the phase it entered, or
 * null when the strike did not count.
 */
export const strikePike = (pike: Pike, alongX: number, alongZ: number): PikePhase | null => (pikeOpen(pike) ? hit(pike, alongX, alongZ) : null);

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const approach = (value: number, target: number, amount: number): number => (value < target ? Math.min(target, value + amount) : Math.max(target, value - amount));

/**
 * Advances the pike by `dt` seconds and works out what it does to the hero.
 * `sees` is where the hero is; `log` is the floating log as it is now (its
 * middle and half sizes), for coming up beside it. While it is `lurking` or
 * `hooked` the game moves it with the fishing (see game.ts) and this only
 * keeps its clocks.
 */
export const stepPike = (
  pike: Pike,
  hero: PikeHero,
  sees: PikeSees,
  log: { x: number; z: number; halfX: number; halfZ: number } | null,
  heroRadius: number,
  previousY: number,
  canBeHurt: boolean,
  dt: number,
): PikeOutcome => {
  const outcome: PikeOutcome = { entered: [] };
  const { spot } = pike;
  const n = spot.numbers;
  const enter = (phase: PikePhase): void => {
    pike.phase = phase;
    pike.timer = 0;
    outcome.entered.push(phase);
  };
  pike.timer += dt;
  pike.sulk = Math.max(0, pike.sulk - dt);
  if (pike.shove.left > 0) {
    const share = Math.min(dt, pike.shove.left) / PIKE.knockTime;
    pike.x = clamp(pike.x + pike.shove.x * share, spot.patch.minX, spot.patch.maxX);
    pike.z = clamp(pike.z + pike.shove.z * share, spot.patch.minZ, spot.patch.maxZ);
    pike.shove.left = Math.max(0, pike.shove.left - dt);
  }
  const deep = spot.surface - PIKE.cruiseDepth;
  const up = spot.surface + PIKE.upHeight;

  /** Swims toward a point at a speed, turning to face the way it goes. True when it is there. */
  const swimTo = (x: number, z: number, speed: number): boolean => {
    const dx = x - pike.x;
    const dz = z - pike.z;
    const far = Math.hypot(dx, dz);
    if (far > 1e-3) pike.facing = Math.atan2(dx, dz);
    if (far <= speed * dt) {
      pike.x = x;
      pike.z = z;
      return true;
    }
    pike.x += (dx / far) * speed * dt;
    pike.z += (dz / far) * speed * dt;
    return false;
  };
  /** Round its log: a point a little ahead of it on the circle, so it swims along the circle and not across it. */
  const circle = (): void => {
    const here = Math.atan2(pike.x - spot.home.x, pike.z - spot.home.z);
    const off = Math.hypot(pike.x - spot.home.x, pike.z - spot.home.z);
    const onIt = Math.abs(off - spot.circle) < 0.6;
    pike.angle = here + 0.3;
    const ahead = circlePoint(spot, pike.angle);
    swimTo(ahead.x, ahead.z, onIt ? PIKE.cruise : PIKE.regroup);
    pike.y = approach(pike.y, deep, PIKE.rise * dt);
  };

  if (pike.phase === 'beaten') {
    // It rolls over and sinks.
    pike.y -= 0.9 * dt * Math.min(1, pike.timer / 0.8);
    return outcome;
  }
  if (pike.phase === 'hooked') return outcome;
  if (pike.phase === 'lurking') {
    if (!pike.led) circle();
    return outcome;
  }

  const dx = hero.x - pike.x;
  const dz = hero.z - pike.z;
  const near = Math.hypot(hero.x - spot.home.x, hero.z - spot.home.z) <= PIKE.range;

  if (pike.phase === 'dragging') {
    circle();
    if (pike.timer >= PIKE.drag) enter('circling');
  } else if (pike.phase === 'stagger') {
    pike.y = approach(pike.y, deep, PIKE.rise * 0.6 * dt);
    if (pike.timer >= PIKE.stagger) {
      enter('circling');
      pike.waited = 0;
    }
  } else if (pike.phase === 'circling') {
    circle();
    // It bides its time only while there is a hero to go for.
    if (sees === 'away' || !near) pike.waited = Math.min(pike.waited, n.wait * 0.5);
    else pike.waited += dt;
    if (pike.waited >= n.wait) {
      pike.waited = 0;
      if (sees === 'water') {
        // Straight through where the swimmer is, and on past.
        const far = Math.hypot(dx, dz) || 1e-6;
        const reach = far + PIKE.chargePast;
        enter('charge-tell');
        pike.from = { x: pike.x, y: pike.y, z: pike.z };
        pike.target = {
          x: clamp(pike.x + (dx / far) * reach, spot.patch.minX, spot.patch.maxX),
          y: spot.surface - PIKE.chargeDepth,
          z: clamp(pike.z + (dz / far) * reach, spot.patch.minZ, spot.patch.maxZ),
        };
        pike.facing = Math.atan2(dx, dz);
      } else if (sees === 'log' && log) {
        // Up beside the log, on the side its own log lies, level with the hero.
        const side = spot.home.x >= log.x ? 1 : -1;
        const longZ = log.halfZ >= log.halfX;
        enter('rising');
        pike.from = longZ
          ? { x: log.x + side * (log.halfX + PIKE.beside), y: up, z: clamp(hero.z, log.z - log.halfZ, log.z + log.halfZ) }
          : { x: clamp(hero.x, log.x - log.halfX, log.x + log.halfX), y: up, z: log.z + (spot.home.z >= log.z ? 1 : -1) * (log.halfZ + PIKE.beside) };
      }
    }
  } else if (pike.phase === 'charge-tell') {
    // Its fin comes up, and it lies along its line.
    pike.y = approach(pike.y, spot.surface - PIKE.chargeDepth, PIKE.rise * dt);
    if (pike.timer >= n.chargeTell) {
      enter('charge');
      pike.from = { x: pike.x, y: pike.y, z: pike.z };
    }
  } else if (pike.phase === 'charge') {
    const length = Math.hypot(pike.target.x - pike.from.x, pike.target.z - pike.from.z);
    const share = clamp(pike.timer / Math.max(length / n.chargeSpeed, 1e-3), 0, 1);
    pike.x = pike.from.x + (pike.target.x - pike.from.x) * share;
    pike.z = pike.from.z + (pike.target.z - pike.from.z) * share;
    pike.y = spot.surface - PIKE.chargeDepth;
    if (share === 1) {
      enter('circling');
      pike.waited = n.wait * 0.4;
    }
  } else if (pike.phase === 'rising') {
    pike.y = approach(pike.y, deep, PIKE.rise * dt);
    if (swimTo(pike.from.x, pike.from.z, PIKE.approach)) {
      // Up it comes, jaws open, aimed at where the hero is right now.
      enter('gape');
      pike.target = { x: hero.x, y: hero.y, z: hero.z };
      pike.facing = Math.atan2(hero.x - pike.x, hero.z - pike.z);
    }
  } else if (pike.phase === 'gape') {
    pike.y = approach(pike.y, up, PIKE.rise * 2 * dt);
    if (pike.timer >= n.snapTell) enter('snap');
  } else if (pike.phase === 'snap') {
    pike.y = up;
    if (pike.timer >= PIKE.snap) enter('rest');
  } else if (pike.phase === 'rest') {
    pike.y = up;
    if (pike.timer >= n.rest) {
      enter('circling');
      pike.waited = 0;
    }
  }

  // Touching it, and landing on it.
  const body = pikeBody(pike);
  const apart = Math.hypot(hero.x - pike.x, hero.z - pike.z);
  const overlapping = apart < heroRadius + body.radius;
  const touching = overlapping && hero.y < body.top && hero.y + hero.bodyHeight > body.bottom;
  const stomp = overlapping && hero.vy < -PIKE.stompSpeed && previousY >= body.top - 0.15 && hero.y <= body.top;
  if (pikeOpen(pike) && (stomp || (touching && hero.striking))) {
    const speed = Math.hypot(hero.vx, hero.vz);
    outcome.struck = hero.pouncing > 0 ? 'pounce' : stomp ? 'stomp' : 'roll';
    outcome.entered.push(hit(pike, speed > 0.1 ? hero.vx : pike.x - hero.x, speed > 0.1 ? hero.vz : pike.z - hero.z));
    return outcome;
  }
  if (stomp && pikeUp(pike)) {
    outcome.blocked = true;
    return outcome;
  }
  // The snap lands where it was aimed, on its first step. A charge hurts whoever it touches.
  const snapped = outcome.entered.includes('snap');
  if (snapped && canBeHurt && Math.hypot(hero.x - pike.target.x, hero.z - pike.target.z) <= n.snapReach && hero.y < spot.surface + PIKE.snapHigh) {
    outcome.hurt = { x: pike.x, z: pike.z };
    return outcome;
  }
  if (pike.phase === 'charge' && touching && canBeHurt) outcome.hurt = { x: pike.x, z: pike.z };
  return outcome;
};
