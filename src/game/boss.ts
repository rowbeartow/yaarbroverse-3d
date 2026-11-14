// Bosses. Any level can end with one: the level gives a `boss` (where it
// lives, its arena, its numbers for the difficulty) and the game runs the
// fight. Game rules only: nothing here draws anything.
//
// How a fight goes:
//   - The boss waits at home. The fight begins when the hero stands in its
//     arena. It opens with a moment of show (`intro`) in which nothing hurts.
//   - Then it goes round a loop: on watch (it walks toward the hero, and
//     touching it hurts), a warning, the attack, and a rest. The warning is
//     the tell: every attack has one, and the attack goes exactly where it
//     was aimed when the warning began.
//   - Its attacks are taken in turn from a list, and the list changes as it
//     loses health: each `stage` has its own. A change of stage is marked
//     with a roar, during which nothing hurts.
//   - A hit (a roll faster than a walk, a pounce, or a landing on top) takes
//     one from its health, staggers it, and cannot be repeated until the
//     stagger is over. Where the level says the boss is `guarded`, only a hit
//     while it rests counts: at other times a landing on top bounces off and
//     does nothing, and a roll or pounce into it is just a touch.
//   - At no health it is beaten. Until then the level's goal cannot be taken.
//   - The older player's rule: when the hero is sent back to a safe bank, the
//     boss is at full health again, at home, and the fight starts over.
//
// The attacks, which any boss may use:
//   throw    Rears up, then throws acorns: one at where the hero stood, or a
//            fan of them spread to either side of that line.
//   charge   Lowers itself, then runs in a straight line through where the
//            hero stood to the far side of its arena. Touching it hurts.
//   call     Rears up and calls its sidekicks: enemies of the level that lie
//            low until called (`sidekickOf` on their spot). Any it had lost
//            come back each time it calls.

import type { Enemy } from './enemy';

/** Distances are metres, times are seconds, speeds are metres per second. */
export const BOSS = {
  /** The show before the fight, the stagger after a hit, and the roar at a change of stage. Nothing hurts in any of them. */
  intro: 1.6,
  stagger: 0.9,
  roar: 1.3,
  /** After the hero is sent back to a safe bank, the boss waits this long before the fight can begin again. */
  grace: 1.5,
  /** On watch it walks toward the hero until it is this close, and no closer. */
  standoff: 6,
  /** An acorn flies this far past where the hero stood, and is this big. */
  acornPast: 3,
  acornRadius: 0.3,
  /** A charge stops this far short of the edge of the boss's patch. */
  chargeMargin: 0,
  /** A hit shoves it this far along the hero's way, over this long. */
  knock: 0.5,
  knockTime: 0.16,
  /** Landing on it, or pouncing it, throws the hero up at this speed. */
  rebound: 11.5,
  /** A landing that bounces off its guard also throws the hero sideways, clear of it, at this speed. */
  bounceOff: 5,
  /** After a hit, or a landing that bounced off, the hero cannot be hurt for this long. */
  strikeProtection: 1,
  /** A hero has to be falling at least this fast for landing on it to count. */
  stompSpeed: 0.8,
  /** A beaten boss is gone from the level this long after it is beaten. */
  fade: 2.2,
  /** Once it is beaten, nothing can hurt the hero for this long: the moment is the player's. */
  victoryProtection: 3,
} as const;

export type BossAttack = 'throw' | 'charge' | 'call';

export type BossPhase = 'waiting' | 'intro' | 'idle' | 'warning' | 'attack' | 'rest' | 'stagger' | 'roar' | 'defeated';

/** The attacks a boss uses, in turn, while its health is at or under a share of its full health. */
export interface BossStage {
  /** This stage begins when health is at or under this share of full health. The first stage is 1. */
  from: number;
  attacks: BossAttack[];
}

/** A boss's numbers for one difficulty. They live in the level's `difficulty.ts`. */
export interface BossNumbers {
  /** Hits it takes to beat it. */
  health: number;
  /** True: only a hit while it rests counts. False: a hit counts whenever it is not staggered. */
  guarded: boolean;
  /** How long it stays on watch between one attack and the next. */
  pause: number;
  /** How fast it walks toward the hero while on watch. */
  walkSpeed: number;
  /** How long the warning before a throw or a call lasts, and before a charge. */
  warning: number;
  chargeWarning: number;
  /** How long it rests after an attack. This is the opening. */
  rest: number;
  /** A throw: how many acorns, how far apart they fan out (in degrees), and how fast they fly. */
  acorns: number;
  spread: number;
  acornSpeed: number;
  /** How fast it charges. */
  chargeSpeed: number;
  /** The attacks it uses as it loses health, first stage first. */
  stages: BossStage[];
  /**
   * Whether lines are drawn showing where its acorns and its charge will go
   * while the warning lasts. The rules do not use this. Without them the
   * warning is what the boss does (it rears up, or lowers itself) and its sound.
   */
  aimLine: boolean;
}

/** Where a boss lives in a level, and what it is. */
export interface BossSpot {
  id: string;
  /** The name on its health bar. */
  name: string;
  /** Which model it is drawn from, how many times that enemy's size, and a colour laid over it (0xRRGGBB), if any. */
  look: { model: 'marmot'; scale: number; tint?: number };
  /** Home: where it waits. y is the ground under its feet. */
  x: number;
  y: number;
  z: number;
  /** The patch it never leaves, seen from above. The fight begins when the hero stands inside `arena`. */
  patch: { minX: number; maxX: number; minZ: number; maxZ: number };
  arena: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Its body: how far out from the middle, and how tall. */
  radius: number;
  height: number;
  numbers: BossNumbers;
}

export interface BossAcorn {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  x: number;
  y: number;
  z: number;
  /** False once it has hit the hero or flown its course. */
  live: boolean;
}

export interface Boss {
  spot: BossSpot;
  x: number;
  y: number;
  z: number;
  phase: BossPhase;
  /** Seconds in this phase. */
  timer: number;
  facing: number;
  health: number;
  /** Which stage it is in (0 first), and which attack of the stage's list comes next. */
  stage: number;
  turn: number;
  /** The attack being warned of, made or rested from. */
  attack: BossAttack | null;
  /** Where a charge starts and ends, or the middle line of a throw: fixed when the warning begins. */
  from: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  acorns: BossAcorn[];
  /** The shove of a hit still to be travelled. */
  shove: { x: number; z: number; left: number };
  /** Counts down after the hero was sent back: the fight cannot begin until it is zero. */
  grace: number;
  /** Fights begun so far, counting the ones started over. */
  fights: number;
}

/** What one step of the boss did. */
export interface BossOutcome {
  /** Phases it entered this step. */
  entered: BossPhase[];
  /** The fight began. */
  began?: boolean;
  /** A hit landed: how. */
  struck?: 'roll' | 'pounce' | 'stomp';
  /** A landing on top bounced off its guard. */
  blocked?: boolean;
  /** It hurt the hero, from here. */
  hurt?: { x: number; z: number };
  /** It moved to this stage (1 is the second). */
  stage?: number;
  /** It called its sidekicks. */
  called?: boolean;
}

/** What a boss needs to know about the hero. The game itself fits this. */
export interface BossHero {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bodyHeight: number;
  grounded: boolean;
  striking: boolean;
  pouncing: number;
}

export const newBoss = (spot: BossSpot): Boss => ({
  spot,
  x: spot.x,
  y: spot.y,
  z: spot.z,
  phase: 'waiting',
  timer: 0,
  facing: 0,
  health: spot.numbers.health,
  stage: 0,
  turn: 0,
  attack: null,
  from: { x: spot.x, y: spot.y, z: spot.z },
  target: { x: spot.x, y: spot.y, z: spot.z },
  acorns: [],
  shove: { x: 0, z: 0, left: 0 },
  grace: 0,
  fights: 0,
});

/**
 * The regen rule: a boss that is not beaten goes home at full health and the
 * fight starts over. Returns true when it had been damaged. A beaten boss
 * stays beaten.
 */
export const resetBoss = (boss: Boss): boolean => {
  if (boss.phase === 'defeated') return false;
  const damaged = boss.health < boss.spot.numbers.health;
  const { fights } = boss;
  Object.assign(boss, newBoss(boss.spot), { grace: BOSS.grace, fights });
  return damaged;
};

/** True while the fight is on: begun and not yet won. */
export const bossFighting = (boss: Boss): boolean => boss.phase !== 'waiting' && boss.phase !== 'defeated';

/** True while a hit would count. */
export const bossOpen = (boss: Boss): boolean => {
  if (boss.phase === 'rest') return true;
  if (boss.spot.numbers.guarded) return false;
  return boss.phase === 'idle' || boss.phase === 'warning' || boss.phase === 'attack';
};

/** True while touching it would hurt. */
export const bossDangerous = (boss: Boss): boolean => boss.phase === 'idle' || (boss.phase === 'attack' && boss.attack === 'charge');

/**
 * Where each acorn of a throw starts and ends, from the middle line fixed
 * when the warning began: one down the middle, or a fan to either side.
 */
export const acornPaths = (boss: Boss): Array<{ from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }> => {
  const n = boss.spot.numbers;
  const alongX = boss.target.x - boss.from.x;
  const alongZ = boss.target.z - boss.from.z;
  const flat = Math.hypot(alongX, alongZ) || 1;
  const reach = flat + BOSS.acornPast;
  const aim = Math.atan2(alongX, alongZ);
  const count = Math.max(1, Math.round(n.acorns));
  const paths = [];
  for (let i = 0; i < count; i += 1) {
    const angle = aim + ((i - (count - 1) / 2) * n.spread * Math.PI) / 180;
    paths.push({ from: { ...boss.from }, to: { x: boss.from.x + Math.sin(angle) * reach, y: boss.target.y, z: boss.from.z + Math.cos(angle) * reach } });
  }
  return paths;
};

/** The stage a boss with this much health is in. */
export const stageFor = (spot: BossSpot, health: number): number => {
  const share = health / spot.numbers.health;
  let stage = 0;
  spot.numbers.stages.forEach((each, i) => {
    if (share <= each.from + 1e-9) stage = i;
  });
  return stage;
};

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/**
 * Advances the boss by `dt` seconds and works out what it does to the hero.
 * `sidekicks` are the level's enemies that answer to this boss.
 */
export const stepBoss = (
  boss: Boss,
  hero: BossHero,
  heroRadius: number,
  previousY: number,
  canBeHurt: boolean,
  stompHelp: number,
  sidekicks: Enemy[],
  dt: number,
): BossOutcome => {
  const outcome: BossOutcome = { entered: [] };
  const { spot } = boss;
  const n = spot.numbers;
  const enter = (phase: BossPhase): void => {
    boss.phase = phase;
    boss.timer = 0;
    outcome.entered.push(phase);
  };
  boss.timer += dt;
  boss.grace = Math.max(0, boss.grace - dt);
  if (boss.shove.left > 0) {
    const share = Math.min(dt, boss.shove.left) / BOSS.knockTime;
    boss.x = clamp(boss.x + boss.shove.x * share, spot.patch.minX, spot.patch.maxX);
    boss.z = clamp(boss.z + boss.shove.z * share, spot.patch.minZ, spot.patch.maxZ);
    boss.shove.left = Math.max(0, boss.shove.left - dt);
  }
  if (boss.phase === 'defeated') {
    boss.acorns = [];
    return outcome;
  }

  const middle = hero.y + hero.bodyHeight / 2;
  const dx = hero.x - boss.x;
  const dz = hero.z - boss.z;
  const distance = Math.hypot(dx, dz);
  const towardX = distance > 1e-6 ? dx / distance : 0;
  const towardZ = distance > 1e-6 ? dz / distance : 1;
  const inArena =
    hero.x >= spot.arena.minX && hero.x <= spot.arena.maxX && hero.z >= spot.arena.minZ && hero.z <= spot.arena.maxZ && Math.abs(hero.y - spot.y) < 6;

  if (boss.phase === 'waiting') {
    if (inArena && hero.grounded && boss.grace === 0) {
      enter('intro');
      boss.fights += 1;
      outcome.began = true;
      boss.facing = Math.atan2(dx, dz);
    }
    return outcome;
  }

  if (boss.phase === 'intro') {
    if (distance > 1e-6) boss.facing = Math.atan2(dx, dz);
    if (boss.timer >= BOSS.intro) enter('idle');
  } else if (boss.phase === 'roar') {
    if (boss.timer >= BOSS.roar) enter('idle');
  } else if (boss.phase === 'stagger') {
    if (boss.timer >= BOSS.stagger) {
      const stage = stageFor(spot, boss.health);
      if (stage !== boss.stage) {
        boss.stage = stage;
        boss.turn = 0;
        outcome.stage = stage;
        enter('roar');
      } else enter('idle');
    }
  } else if (boss.phase === 'idle') {
    if (distance > 1e-6) boss.facing = Math.atan2(dx, dz);
    if (distance > BOSS.standoff) {
      boss.x = clamp(boss.x + towardX * n.walkSpeed * dt, spot.patch.minX, spot.patch.maxX);
      boss.z = clamp(boss.z + towardZ * n.walkSpeed * dt, spot.patch.minZ, spot.patch.maxZ);
    }
    if (boss.timer >= n.pause) {
      const list = n.stages[boss.stage]?.attacks ?? [];
      // A boss with nobody to call throws instead.
      let attack: BossAttack = list.length ? list[boss.turn % list.length] : 'throw';
      if (attack === 'call' && sidekicks.length === 0) attack = 'throw';
      boss.turn += 1;
      boss.attack = attack;
      enter('warning');
      const top = boss.y + spot.height;
      if (attack === 'charge') {
        // Straight through where the hero stands, to the far side of its patch.
        let reach = Infinity;
        if (towardX > 1e-6) reach = Math.min(reach, (spot.patch.maxX - boss.x) / towardX);
        if (towardX < -1e-6) reach = Math.min(reach, (spot.patch.minX - boss.x) / towardX);
        if (towardZ > 1e-6) reach = Math.min(reach, (spot.patch.maxZ - boss.z) / towardZ);
        if (towardZ < -1e-6) reach = Math.min(reach, (spot.patch.minZ - boss.z) / towardZ);
        reach = Math.max(0, (Number.isFinite(reach) ? reach : 0) - BOSS.chargeMargin);
        boss.from = { x: boss.x, y: boss.y, z: boss.z };
        boss.target = { x: boss.x + towardX * reach, y: boss.y, z: boss.z + towardZ * reach };
      } else {
        boss.from = { x: boss.x, y: top, z: boss.z };
        boss.target = { x: hero.x, y: middle, z: hero.z };
      }
    }
  } else if (boss.phase === 'warning') {
    const length = boss.attack === 'charge' ? n.chargeWarning : n.warning;
    if (boss.timer >= length) {
      enter('attack');
      if (boss.attack === 'throw') {
        // One acorn down the middle line, or a fan to either side of it.
        boss.acorns = acornPaths(boss).map(({ from, to }) => ({ from, to, x: from.x, y: from.y, z: from.z, live: true }));
      } else if (boss.attack === 'call') {
        outcome.called = true;
      }
    }
  } else if (boss.phase === 'attack') {
    if (boss.attack === 'charge') {
      const length = Math.hypot(boss.target.x - boss.from.x, boss.target.z - boss.from.z);
      const seconds = Math.max(length / n.chargeSpeed, 1e-3);
      const share = clamp(boss.timer / seconds, 0, 1);
      boss.x = boss.from.x + (boss.target.x - boss.from.x) * share;
      boss.z = boss.from.z + (boss.target.z - boss.from.z) * share;
      if (length > 1e-6) boss.facing = Math.atan2(boss.target.x - boss.from.x, boss.target.z - boss.from.z);
      if (share === 1) enter('rest');
    } else if (boss.attack === 'throw') {
      let flying = false;
      for (const acorn of boss.acorns) {
        if (!acorn.live) continue;
        const flat = Math.hypot(acorn.to.x - acorn.from.x, acorn.to.z - acorn.from.z);
        const share = clamp((boss.timer * n.acornSpeed) / flat, 0, 1);
        // It comes down to the hero's height over the first part of its flight, then flies level.
        const drop = clamp(share / ((flat - BOSS.acornPast) / flat), 0, 1);
        acorn.x = acorn.from.x + (acorn.to.x - acorn.from.x) * share;
        acorn.z = acorn.from.z + (acorn.to.z - acorn.from.z) * share;
        acorn.y = acorn.from.y + (acorn.to.y - acorn.from.y) * drop;
        if (share === 1) acorn.live = false;
        else flying = true;
      }
      if (!flying) enter('rest');
    } else if (boss.timer >= 0.4) enter('rest');
  } else if (boss.phase === 'rest') {
    if (boss.timer >= n.rest) {
      enter('idle');
      boss.attack = null;
    }
  }
  if (boss.phase !== 'attack') boss.acorns = [];

  // Touching it, and landing on it.
  const top = boss.y + spot.height;
  const apart = Math.hypot(hero.x - boss.x, hero.z - boss.z);
  const overlapping = apart < heroRadius + spot.radius;
  const touching = overlapping && hero.y < top && hero.y + hero.bodyHeight > boss.y;
  // Feet a little under its top still count as landing on it, as much as the level helps with ledges.
  const stomp = overlapping && hero.vy < -BOSS.stompSpeed && previousY >= top - Math.max(0.1, stompHelp) && hero.y <= top;
  const open = bossOpen(boss);
  const settled = boss.phase !== 'intro' && boss.phase !== 'stagger' && boss.phase !== 'roar';
  if (settled && open && (stomp || (touching && hero.striking))) {
    boss.health -= 1;
    boss.acorns = [];
    const speed = Math.hypot(hero.vx, hero.vz);
    const awayX = speed > 0.1 ? hero.vx / speed : apart > 1e-6 ? (boss.x - hero.x) / apart : 0;
    const awayZ = speed > 0.1 ? hero.vz / speed : apart > 1e-6 ? (boss.z - hero.z) / apart : 0;
    boss.shove = { x: awayX * BOSS.knock, z: awayZ * BOSS.knock, left: BOSS.knockTime };
    outcome.struck = hero.pouncing > 0 ? 'pounce' : stomp ? 'stomp' : 'roll';
    enter(boss.health <= 0 ? 'defeated' : 'stagger');
    if (boss.health <= 0) boss.health = 0;
    return outcome;
  }
  if (stomp) {
    // On its guard, or in a moment of show: the landing bounces off and nothing else happens.
    outcome.blocked = true;
    return outcome;
  }

  const dangerous = bossDangerous(boss) || (outcome.entered.includes('rest') && boss.attack === 'charge');
  if (touching && dangerous && canBeHurt) {
    outcome.hurt = { x: boss.x, z: boss.z };
    return outcome;
  }
  for (const acorn of boss.acorns) {
    if (!acorn.live) continue;
    const hit =
      Math.hypot(hero.x - acorn.x, hero.z - acorn.z) < heroRadius + BOSS.acornRadius &&
      acorn.y > hero.y - BOSS.acornRadius &&
      acorn.y < hero.y + hero.bodyHeight + BOSS.acornRadius;
    if (hit && canBeHurt) {
      acorn.live = false;
      outcome.hurt = { x: acorn.from.x, z: acorn.from.z };
      break;
    }
  }
  return outcome;
};
