// The monster pike: a boss that is fought on the fishing line and then in the
// water (milestone eleven, part two). Game rules only: nothing here draws
// anything. A level gives a `pike` (where it lives, the floating log, its
// numbers for the difficulty) beside its fishing spot, and the game runs the
// fight.
//
// The owner's design (docs/decisions.md, 2026-11-19):
//   lurking    Its shadow swims a circle in the fishing water. It is the
//              monster in fishing.ts: a lure near it hooks it.
//   hooked     A tug of war from the fishing spot: reel while it tires, let
//              the line run while it thrashes, or the line snaps. Each stretch
//              of line reeled in takes a pip. A snapped line, or leaving the
//              spot, and it is off the hook with every pip back.
//   dragging   With half its pips gone it drags the hero off the spot and
//              into the lake. Nothing hurts while the hero is in the air.
//   circling   The water half. It swims its circle, under the surface.
//   charge     A hero swimming in its water is charged: a tell (it turns to
//              aim, and on Easy a line shows where), then a rush straight
//              along that line. Only the rush hurts. Swim out of the line.
//   snap       A hero standing on the floating log is snapped at: it comes to
//              the end of the log nearer the hero and surfaces, jaws wide
//              (the tell), then throws itself up the log to where the hero
//              stood. It never reaches the far part of the log. Then it lies
//              there with its head on the log, spent (`rest`): the opening.
//   a hit      Landing on its head, a roll faster than a walk or a pounce
//              into it while it rests takes a pip (`pikeOpen`). It thrashes
//              back into the water and circles again.
//   beaten     At no pips it sinks. Until then the level's goal cannot be taken.
//
// The older player's rule: when the hero is sent back to a safe bank, the
// pike is at full health again, back in the fishing water, and the fight
// starts over from the hook.
//
// Distances are metres, times are seconds, speeds are metres per second.

export const PIKE = {
  /** How deep its back lies while it circles, and how deep its shadow lies while it is in the fishing water. */
  depth: 1.3,
  /** Its head, for touching: how far out from its middle, and how tall it stands over the log while it lies on it. */
  radius: 0.95,
  headRise: 0.75,
  /** After it drags the hero in it circles this much longer before its first attack, so there is time to reach the log. */
  firstPause: 2.5,
  /** Coming for a snap, it surfaces this far off the end of the log, and swims there this many times as fast as it circles. */
  offEnd: 2.2,
  hurry: 1.8,
  /** A snap reaches no further than this share of the log from the end it came up at, and goes this far past where the hero stood. */
  snapShare: 0.58,
  snapPast: 0.9,
  /** Seconds the throw up the log takes. */
  snapTime: 0.22,
  /** After a hit it thrashes for this long before it is back in the water. Nothing hurts. */
  stagger: 1,
  /** A hit throws the hero up at this speed (landing on it, or a pounce). */
  rebound: 9,
  /** After a hit the hero cannot be hurt for this long, and once it is beaten for this long. */
  strikeProtection: 1,
  victoryProtection: 3,
  /** A hero has to be falling at least this fast for landing on it to count. */
  stompSpeed: 0.8,
  /** After the hero is sent back, it waits this long before it will take a lure again. */
  grace: 1.5,
  /** While the hero is dragged through the air nothing can hurt, for at most this long. */
  dragTime: 3,
  /** The drag throws the hero up at this speed. */
  dragUp: 5,
} as const;

export type PikePhase = 'lurking' | 'hooked' | 'dragging' | 'circling' | 'chargeTell' | 'charge' | 'closing' | 'snapTell' | 'snap' | 'rest' | 'stagger' | 'defeated';

/** A pike's numbers for one difficulty. They live in the level's `difficulty.ts`; the tug of war's are `monster` in its fishing numbers. */
export interface PikeNumbers {
  /** Pips in all. The tug of war takes `monster.pips` of them and the water half the rest. */
  health: number;
  /** How fast it swims its circle, and how long it circles between attacks. */
  swimSpeed: number;
  pause: number;
  /** A charge at a swimmer: how long the tell lasts, how fast the rush is and how far it goes. */
  chargeWarning: number;
  chargeSpeed: number;
  chargeReach: number;
  /** A snap at a hero on the log: how long it shows its jaws first, and how long it lies spent afterwards (the opening). */
  snapWarning: number;
  rest: number;
  /** Whether lines are drawn where a charge and a snap will go (Easy only, by the owner's rule). The rules do not use this. */
  aimLine: boolean;
}

/** Where a level's pike lives, and what it is. */
export interface PikeSpot {
  id: string;
  /** The name on its health bar. */
  name: string;
  /** Nose to tail, for drawing and for the tests. */
  length: number;
  /** The pool it fights in, with its surface and floor. */
  water: string;
  surface: number;
  floor: number;
  /** The middle of the circle it swims in the water half, and how wide the circle. */
  home: { x: number; z: number };
  circle: number;
  /** The floating log a hero strikes it from: a solid of the level, longer than it is wide. */
  log: string;
  /** Where the drag puts the hero in the water. */
  landAt: { x: number; z: number };
  numbers: PikeNumbers;
}

export interface Pike {
  spot: PikeSpot;
  /** Where its head is. y is the middle of its head. */
  x: number;
  y: number;
  z: number;
  facing: number;
  phase: PikePhase;
  /** Seconds in this phase. */
  timer: number;
  health: number;
  /** How far round its circle it is, 0 to 1, and how long it still circles before it may attack. */
  loop: number;
  wait: number;
  /** Where a charge or a snap starts and ends: fixed when its tell begins. */
  from: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** Counts down after the hero was sent back: it takes no lure until it is zero. */
  grace: number;
  /** Fights begun so far (times it was hooked). */
  fights: number;
}

export interface PikeOutcome {
  entered: PikePhase[];
  /** A hit landed: how. */
  struck?: 'roll' | 'pounce' | 'stomp';
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
  grounded: boolean;
  groundId: string | null;
  swimming: boolean;
  waterId: string | null;
  climbing: number;
  striking: boolean;
  pouncing: number;
}

/** The floating log, as the pike needs it. */
export interface PikeLog {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  top: number;
}

export const newPike = (spot: PikeSpot): Pike => ({
  spot,
  x: spot.home.x + spot.circle,
  y: spot.surface - PIKE.depth,
  z: spot.home.z,
  facing: 0,
  phase: 'lurking',
  timer: 0,
  health: spot.numbers.health,
  loop: 0,
  wait: 0,
  from: { x: spot.home.x, y: spot.surface - PIKE.depth, z: spot.home.z },
  target: { x: spot.home.x, y: spot.surface - PIKE.depth, z: spot.home.z },
  grace: 0,
  fights: 0,
});

/** True while the fight is on: hooked and not yet beaten. */
export const pikeFighting = (pike: Pike): boolean => pike.phase !== 'lurking' && pike.phase !== 'defeated';

/** True in the water half of the fight. */
export const pikeInWater = (pike: Pike): boolean => pikeFighting(pike) && pike.phase !== 'hooked';

/** True while a hit would count: it lies spent with its head on the log. */
export const pikeOpen = (pike: Pike): boolean => pike.phase === 'rest';

/** True while touching it would hurt: the rush of a charge, and the throw of a snap. */
export const pikeDangerous = (pike: Pike): boolean => pike.phase === 'charge' || pike.phase === 'snap';

/**
 * The regen rule: a pike that is not beaten is at full health, back in the
 * fishing water, and takes no lure for a moment. Returns true when it had
 * been damaged. A beaten pike stays beaten.
 */
export const resetPike = (pike: Pike): boolean => {
  if (pike.phase === 'defeated') return false;
  const damaged = pike.health < pike.spot.numbers.health;
  const { fights } = pike;
  Object.assign(pike, newPike(pike.spot), { grace: PIKE.grace, fights });
  return damaged;
};

/** Takes one pip. Returns true when that was its last. */
export const hitPike = (pike: Pike): boolean => {
  pike.health = Math.max(0, pike.health - 1);
  pike.phase = pike.health === 0 ? 'defeated' : 'stagger';
  pike.timer = 0;
  return pike.health === 0;
};

/** The log's long way: a step of length 1 along it, and half its length. */
const logAxis = (log: PikeLog): { x: number; z: number; half: number; across: number } =>
  log.halfZ >= log.halfX ? { x: 0, z: 1, half: log.halfZ, across: log.halfX } : { x: 1, z: 0, half: log.halfX, across: log.halfZ };

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** Where it is on its circle, `loop` of the way round. */
const onCircle = (spot: PikeSpot, loop: number): { x: number; z: number } => ({
  x: spot.home.x + spot.circle * Math.cos(loop * Math.PI * 2),
  z: spot.home.z + spot.circle * Math.sin(loop * Math.PI * 2),
});

/** Swims its head toward a point at a speed, turning to face the way it goes. True when it is there. */
const swimTo = (pike: Pike, x: number, z: number, speed: number, dt: number): boolean => {
  const far = Math.hypot(x - pike.x, z - pike.z);
  if (far > 1e-3) pike.facing = Math.atan2(x - pike.x, z - pike.z);
  if (far <= speed * dt) {
    pike.x = x;
    pike.z = z;
    return true;
  }
  pike.x += ((x - pike.x) / far) * speed * dt;
  pike.z += ((z - pike.z) / far) * speed * dt;
  return false;
};

const approach = (value: number, target: number, amount: number): number => (value < target ? Math.min(target, value + amount) : Math.max(target, value - amount));

/**
 * Advances the pike by `dt` seconds in the water half of its fight and works
 * out what it does to the hero. While it lurks or is on the line the game
 * puts it where the fishing rules have the monster, and this does nothing.
 */
export const stepPike = (pike: Pike, hero: PikeHero, log: PikeLog, heroRadius: number, previousY: number, canBeHurt: boolean, dt: number): PikeOutcome => {
  const outcome: PikeOutcome = { entered: [] };
  const { spot } = pike;
  const n = spot.numbers;
  const enter = (phase: PikePhase): void => {
    pike.phase = phase;
    pike.timer = 0;
    outcome.entered.push(phase);
  };
  pike.timer += dt;
  pike.grace = Math.max(0, pike.grace - dt);
  const deep = spot.surface - PIKE.depth;
  if (pike.phase === 'lurking' || pike.phase === 'hooked') return outcome;
  if (pike.phase === 'defeated') {
    // It rolls over and sinks.
    pike.y = Math.max(spot.floor + 0.5, pike.y - 0.9 * dt);
    return outcome;
  }

  const axis = logAxis(log);
  const onLog = hero.grounded && hero.groundId === spot.log;
  const inWater = (hero.swimming && hero.waterId === spot.water) || hero.climbing > 0;
  const circle = (speed: number): void => {
    const at = onCircle(spot, pike.loop);
    if (swimTo(pike, at.x, at.z, speed * PIKE.hurry, dt) || Math.hypot(at.x - pike.x, at.z - pike.z) < 0.6) pike.loop = (pike.loop + (speed * dt) / (Math.PI * 2 * spot.circle)) % 1;
    pike.y = approach(pike.y, deep, 1.5 * dt);
  };

  if (pike.phase === 'dragging') {
    circle(n.swimSpeed);
    if (inWater || onLog || pike.timer >= PIKE.dragTime) {
      enter('circling');
      pike.wait = n.pause + PIKE.firstPause;
    }
  } else if (pike.phase === 'circling') {
    circle(n.swimSpeed);
    pike.wait = Math.max(0, pike.wait - dt);
    if (pike.wait === 0 && onLog) {
      // To the end of the log nearer the hero, a little off it. The end is chosen now and kept.
      const along = (hero.x - log.x) * axis.x + (hero.z - log.z) * axis.z;
      const reach = (axis.half + PIKE.offEnd) * (along >= 0 ? 1 : -1);
      pike.target = { x: log.x + axis.x * reach, y: deep, z: log.z + axis.z * reach };
      enter('closing');
    } else if (pike.wait === 0 && hero.swimming && hero.waterId === spot.water) {
      // A charge, aimed at where the swimmer is now and at their depth, and as long as its reach.
      const middle = clamp(hero.y + hero.bodyHeight / 2, spot.floor + 0.6, spot.surface - 0.3);
      const dx = hero.x - pike.x;
      const dz = hero.z - pike.z;
      const flat = Math.hypot(dx, dz) || 1e-6;
      pike.from = { x: pike.x, y: pike.y, z: pike.z };
      pike.target = { x: pike.x + (dx / flat) * n.chargeReach, y: middle, z: pike.z + (dz / flat) * n.chargeReach };
      pike.facing = Math.atan2(dx, dz);
      enter('chargeTell');
    }
  } else if (pike.phase === 'chargeTell') {
    // The tell: it hangs where it is, turned along its aim, and sinks or rises to the swimmer's depth.
    pike.y = approach(pike.y, pike.target.y, 1.5 * dt);
    if (pike.timer >= n.chargeWarning) {
      pike.from = { x: pike.x, y: pike.y, z: pike.z };
      enter('charge');
    }
  } else if (pike.phase === 'charge') {
    const seconds = Math.max(n.chargeReach / n.chargeSpeed, 1e-3);
    const share = clamp(pike.timer / seconds, 0, 1);
    pike.x = pike.from.x + (pike.target.x - pike.from.x) * share;
    pike.y = pike.from.y + (pike.target.y - pike.from.y) * Math.min(1, share * 2);
    pike.z = pike.from.z + (pike.target.z - pike.from.z) * share;
    if (share === 1) {
      enter('circling');
      pike.wait = n.pause;
    }
  } else if (pike.phase === 'closing') {
    const there = swimTo(pike, pike.target.x, pike.target.z, n.swimSpeed * PIKE.hurry, dt);
    pike.y = approach(pike.y, deep, 1.5 * dt);
    if (there) {
      const end = (pike.x - log.x) * axis.x + (pike.z - log.z) * axis.z >= 0 ? 1 : -1;
      const over = Math.abs((hero.x - log.x) * axis.z - (hero.z - log.z) * axis.x) <= axis.across + 0.5 && hero.y >= log.top - 0.1 && !hero.swimming;
      if (!onLog && !over) {
        // The hero left the log before it got there: back to its circle, and not for long.
        enter('circling');
        pike.wait = n.pause * 0.5;
      } else {
        // The tell begins, and the snap is aimed: up the log past where the hero stands, never past its reach.
        const heroAlong = clamp(((hero.x - log.x) * axis.x + (hero.z - log.z) * axis.z) * end, -axis.half, axis.half);
        const farthest = axis.half - axis.half * 2 * PIKE.snapShare;
        const stopAt = Math.max(farthest, heroAlong - PIKE.snapPast);
        pike.from = { x: pike.x, y: log.top + PIKE.headRise * 0.3, z: pike.z };
        pike.target = { x: log.x + axis.x * end * stopAt, y: log.top + PIKE.headRise * 0.5, z: log.z + axis.z * end * stopAt };
        pike.facing = Math.atan2(-axis.x * end, -axis.z * end);
        enter('snapTell');
      }
    }
  } else if (pike.phase === 'snapTell') {
    // It surfaces off the end of the log, jaws wide.
    pike.y = approach(pike.y, pike.from.y, 4 * dt);
    if (pike.timer >= n.snapWarning) {
      pike.from = { x: pike.x, y: pike.y, z: pike.z };
      enter('snap');
    }
  } else if (pike.phase === 'snap') {
    const share = clamp(pike.timer / PIKE.snapTime, 0, 1);
    pike.x = pike.from.x + (pike.target.x - pike.from.x) * share;
    pike.y = pike.from.y + (pike.target.y - pike.from.y) * share;
    pike.z = pike.from.z + (pike.target.z - pike.from.z) * share;
    if (share === 1) enter('rest');
  } else if (pike.phase === 'rest') {
    if (pike.timer >= n.rest) {
      enter('circling');
      pike.wait = n.pause;
    }
  } else if (pike.phase === 'stagger') {
    // It thrashes back off the log and under.
    pike.y = approach(pike.y, deep, 2.5 * dt);
    if (pike.timer >= PIKE.stagger) {
      enter('circling');
      pike.wait = n.pause;
    }
  }

  // Touching its head, and landing on it.
  const top = pike.y + PIKE.headRise * 0.5;
  const bottom = pike.y - PIKE.radius;
  const apart = Math.hypot(hero.x - pike.x, hero.z - pike.z);
  const overlapping = apart < heroRadius + PIKE.radius;
  const touching = overlapping && hero.y < top && hero.y + hero.bodyHeight > bottom;
  const stomp = overlapping && hero.vy < -PIKE.stompSpeed && previousY >= top - 0.25 && hero.y <= top;
  if (pikeOpen(pike) && (stomp || (touching && hero.striking))) {
    outcome.struck = hero.pouncing > 0 ? 'pounce' : stomp ? 'stomp' : 'roll';
    outcome.entered.push(hitPike(pike) ? 'defeated' : 'stagger');
    return outcome;
  }
  // The rush of a charge hurts whoever its head touches. The throw of a snap hurts anyone on the stretch of log it
  // came up, from the end to where its head lands.
  if (!canBeHurt) return outcome;
  if (pike.phase === 'charge' && touching) outcome.hurt = { x: pike.x, z: pike.z };
  else if (pike.phase === 'snap' || outcome.entered.includes('rest')) {
    const sx = pike.x - pike.from.x;
    const sz = pike.z - pike.from.z;
    const length = sx * sx + sz * sz;
    const share = length > 1e-9 ? clamp(((hero.x - pike.from.x) * sx + (hero.z - pike.from.z) * sz) / length, 0, 1) : 0;
    const off = Math.hypot(hero.x - (pike.from.x + sx * share), hero.z - (pike.from.z + sz * share));
    if (off < heroRadius + PIKE.radius && hero.y < top && hero.y + hero.bodyHeight > log.top - 0.6) outcome.hurt = { x: pike.from.x, z: pike.from.z };
  }
  return outcome;
};
