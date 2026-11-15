// The crocodile: an enemy that lives in the water (milestone eight, part
// three). Game rules only: nothing here draws anything. `stepEnemy` in
// enemy.ts calls `moveCrocodile` for where it goes; touching it is settled
// there with every other enemy.
//
// The owner's rules (docs/decisions.md, 2026-11-14 and 2026-11-15):
//   - It reaches a hero at the surface and underwater. It is the one enemy
//     that hurts a swimmer whose head is under.
//   - On Easy every crocodile can be avoided without diving or precise
//     timing: on Easy the lake keeps them to the side of the way across, and
//     their warning is long and shown with a line.
//   - Each hero's move beats it or gets past it. In the water the move button
//     dives, and a dive takes a hero out of the line of a lunge. Landing on it
//     from above beats it, and so does Yaarbro's roll or Caputo's pounce from
//     a log or the bank.
//   - The regen rule applies: a hero sent back to a safe bank finds every
//     crocodile not beaten at home at full health (`sendHome`).
//
// How it goes:
//   lurking   (`concealed`) It waits at home, low in the water, only its eyes
//             and snout above the surface. Touching it does nothing.
//   stalking  (`idle`) A hero is in its stretch of water: it swims after
//             them, at their depth, slower than a hero swims at the surface.
//   the tell  (`warning`) Close enough, it fixes its aim on where the hero
//             is. Its eyes sink under, and it creeps along that line, so a
//             wake heads for the hero. On Easy a line shows the aim.
//   the lunge (`attack`) It shoots along the line, a little past where the
//             hero was, jaws snapping. Touching it now hurts.
//   resting   (`rest`) It lies at the surface, back awash, catching its
//             breath: the opening to land on it, or to swim on past.
//
// Distances are metres, times are seconds, speeds are metres per second. Each
// level's difficulty sets how fast it swims (`crocSpeed`), how far it lunges
// (`crocReach`), and stretches its warning, lunge and rest like any enemy's.

import type { Enemy, EnemyPhase, EnemyTuning, HeroBody } from './enemy';

export const CROC = {
  /** How deep its middle lies while lurking or resting: deep enough that only its eyes and snout show. */
  lurkDepth: 0.25,
  /** Its body for touching, as an upright can around its middle. */
  radius: 0.8,
  halfHeight: 0.3,
  /** Stalking: how fast it swims after a hero when the level does not say (`crocSpeed`), and how quickly it changes depth. */
  speed: 2.2,
  climbSpeed: 1.6,
  /** It readies this long, in reach, before its tell begins. */
  ready: 0.6,
  /** It begins its tell when the hero is this close, seen from the side and from above together. */
  lungeFrom: 3.6,
  /** How long its tell lasts, times the difficulty's `warning`; how far its eyes sink in that time; how fast it creeps along its aim. */
  warning: 0.9,
  sink: 0.35,
  creep: 0.7,
  /** The lunge: how far, when the level does not say (`crocReach`), and how long it takes, divided by the difficulty's `speed`. It goes this much past where it aimed, and never further than its reach. */
  reach: 4.5,
  lungeTime: 0.42,
  overshoot: 1,
  /** How long it rests after a lunge, times the difficulty's `rest`. */
  rest: 1.6,
  /** How fast it goes home when no hero is in its water. */
  homeSpeed: 1.4,
  /** Strikes that beat it, when the level does not say (`crocHits`). */
  hits: 1,
} as const;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const approach = (value: number, target: number, amount: number): number =>
  value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

/** The depth its middle may go to, from just under the surface to just over the floor. */
const depths = (enemy: Enemy): { top: number; bottom: number } => {
  const surface = enemy.spot.surface ?? enemy.spot.y + CROC.lurkDepth;
  const floor = enemy.spot.floor ?? surface - 4;
  return { top: surface - CROC.lurkDepth, bottom: floor + CROC.halfHeight + 0.1 };
};

/**
 * Moves a crocodile for one step: lurking, stalking, its tell, the lunge and
 * the rest. `nearby` is whether the hero is in its stretch of water, and
 * `enter` changes its phase and reports it.
 */
export const moveCrocodile = (enemy: Enemy, hero: HeroBody, tuning: EnemyTuning, nearby: boolean, dt: number, enter: (phase: EnemyPhase) => void): void => {
  const { arena } = enemy.spot;
  const reach = enemy.spot.notice ?? 0;
  const { top, bottom } = depths(enemy);
  const middle = hero.y + hero.bodyHeight / 2;
  const heroDepth = clamp(middle, bottom, top);
  const dx = hero.x - enemy.x;
  const dz = hero.z - enemy.z;
  const distance = Math.hypot(dx, dz);
  const apart = Math.hypot(dx, dz, heroDepth - enemy.y);
  const stayIn = (): void => {
    enemy.x = clamp(enemy.x, arena.minX, arena.maxX);
    enemy.z = clamp(enemy.z, arena.minZ, arena.maxZ);
  };

  if (enemy.phase === 'concealed' && nearby) enter('idle');

  if (enemy.phase === 'concealed') {
    enemy.y = approach(enemy.y, top, CROC.climbSpeed * dt);
  } else if (enemy.phase === 'idle') {
    if (!nearby) {
      // The hero has left its water: it goes home and lies low again.
      const gap = Math.hypot(enemy.spot.x - enemy.x, enemy.spot.z - enemy.z);
      const step = CROC.homeSpeed * tuning.speed * dt;
      if (gap > step) {
        enemy.facing = Math.atan2(enemy.spot.x - enemy.x, enemy.spot.z - enemy.z);
        enemy.x += ((enemy.spot.x - enemy.x) / gap) * step;
        enemy.z += ((enemy.spot.z - enemy.z) / gap) * step;
      } else {
        enemy.x = enemy.spot.x;
        enemy.z = enemy.spot.z;
        enter('concealed');
      }
      enemy.y = approach(enemy.y, top, CROC.climbSpeed * dt);
      enemy.timer = 0;
    } else {
      // After the hero, at the hero's depth.
      if (distance > 1e-6) enemy.facing = Math.atan2(dx, dz);
      const step = (tuning.crocSpeed ?? CROC.speed * tuning.speed) * dt;
      if (distance > CROC.lungeFrom * 0.6 && distance > step) {
        enemy.x += (dx / distance) * step;
        enemy.z += (dz / distance) * step;
      }
      enemy.y = approach(enemy.y, heroDepth, CROC.climbSpeed * dt);
      stayIn();
      if (enemy.timer >= CROC.ready && apart <= CROC.lungeFrom) {
        enter('warning');
        enemy.from = { x: enemy.x, y: enemy.y, z: enemy.z };
        // Aimed at where the hero is now, in the water, and no further than it can lunge.
        const along = Math.max(apart, 1e-6);
        const lunge = Math.min(apart + CROC.overshoot, tuning.crocReach ?? CROC.reach);
        enemy.target = {
          x: clamp(enemy.x + (dx / along) * lunge, arena.minX - reach, arena.maxX + reach),
          y: clamp(enemy.y + ((heroDepth - enemy.y) / along) * lunge, bottom, top),
          z: clamp(enemy.z + (dz / along) * lunge, arena.minZ - reach, arena.maxZ + reach),
        };
      }
    }
  } else if (enemy.phase === 'warning') {
    // The tell: its eyes sink under, and it creeps along its aim, pushing a wake ahead.
    const sinkTo = Math.max(bottom, enemy.from.y - CROC.sink);
    enemy.y = approach(enemy.y, sinkTo, (CROC.sink / (CROC.warning * tuning.warning)) * 1.5 * dt);
    const gx = enemy.target.x - enemy.x;
    const gz = enemy.target.z - enemy.z;
    const gap = Math.hypot(gx, gz);
    if (gap > 1.5) {
      enemy.x += (gx / gap) * CROC.creep * dt;
      enemy.z += (gz / gap) * CROC.creep * dt;
    }
    if (enemy.timer >= CROC.warning * tuning.warning) {
      enter('attack');
      enemy.from = { x: enemy.x, y: enemy.y, z: enemy.z };
    }
  } else if (enemy.phase === 'attack') {
    // The lunge, along exactly the line it aimed.
    const share = clamp(enemy.timer / (CROC.lungeTime / tuning.speed), 0, 1);
    const eased = 1 - (1 - share) ** 2;
    enemy.x = enemy.from.x + (enemy.target.x - enemy.from.x) * eased;
    enemy.y = enemy.from.y + (enemy.target.y - enemy.from.y) * eased;
    enemy.z = enemy.from.z + (enemy.target.z - enemy.from.z) * eased;
    if (share === 1) enter('rest');
  } else if (enemy.phase === 'rest') {
    // It comes up to lie at the surface and get its breath back.
    enemy.y = approach(enemy.y, top, CROC.climbSpeed * dt);
    stayIn();
    if (enemy.timer >= CROC.rest * tuning.rest) enter('idle');
  }
};
