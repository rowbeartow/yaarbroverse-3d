// Bosses: the arena, the loop of warning, attack and rest, the stages, what
// a hit does, the guard, the locked goal, sidekicks, and the regen rule.

import { describe, expect, it } from 'vitest';
import { BOSS, bossOpen, stageFor, type BossNumbers, type BossPhase, type BossSpot } from '../src/game/boss';
import { DIFFICULTIES } from '../src/game/difficulty';
import type { EnemySpot } from '../src/game/enemy';
import { Game, IDLE, type GameEvent, type Input } from '../src/game/game';
import { HEROES, MOVE, STEP, type HeroName } from '../src/game/hero';
import { SANDBOX_DIFFICULTY } from '../src/levels/sandbox/difficulty';
import { buildSandbox } from '../src/levels/sandbox/layout';
import { playWithBot } from './helpers/bot';
import { solid, yard } from './helpers/yard';

const NUMBERS: BossNumbers = {
  health: 4,
  guarded: false,
  pause: 1,
  walkSpeed: 1.5,
  warning: 0.8,
  chargeWarning: 1,
  rest: 2,
  acorns: 1,
  spread: 0,
  acornSpeed: 8,
  chargeSpeed: 10,
  stages: [
    { from: 1, attacks: ['throw'] },
    { from: 0.5, attacks: ['charge'] },
  ],
  aimLine: true,
};

/** The yard's floor runs to x = 10; the arena is the next solid, x from 10 to 28. The boss waits at x = 20. */
const bossAt = (numbers: Partial<BossNumbers> = {}): BossSpot => ({
  id: 'big',
  name: 'Big one',
  look: { model: 'marmot', scale: 2 },
  x: 20,
  y: 0,
  z: 0,
  patch: { minX: 12, maxX: 26.5, minZ: -6.5, maxZ: 6.5 },
  arena: { minX: 10.5, maxX: 28, minZ: -8, maxZ: 8 },
  radius: 1.1,
  height: 1.6,
  numbers: { ...NUMBERS, ...numbers },
});
const field = (numbers: Partial<BossNumbers> = {}, more: Partial<Parameters<typeof yard>[1]> = {}) =>
  yard([solid('arena', 19, 0, 9, 8, 0, { safe: true, safeAt: { x: 11.5, z: 0 } })], { boss: bossAt(numbers), leaf: { x: 27, y: 1.3, z: 0, radius: 0.7 }, ...more });
const play = (numbers: Partial<BossNumbers> = {}, hero: HeroName = 'Yaarbro', more: Partial<Parameters<typeof yard>[1]> = {}): Game => new Game(field(numbers, more), 'normal', hero);
const stand = (game: Game, x: number, z = 0): void => {
  Object.assign(game, { x, z, y: 0, vx: 0, vy: 0, vz: 0, grounded: true });
};
type BossEvent = Extract<GameEvent, { type: 'boss' }>;
const run = (game: Game, input: Partial<Input>, seconds: number): BossEvent[] => {
  const seen: BossEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    game.step({ ...IDLE, ...input });
    for (const event of game.events) if (event.type === 'boss') seen.push(event);
  }
  return seen;
};
const phases = (events: BossEvent[]): BossPhase[] => events.flatMap((event) => (event.what === 'phase' ? [event.phase] : []));
/** Starts the fight and plays through the intro. */
const begin = (game: Game, x = 13): void => {
  stand(game, x);
  run(game, {}, BOSS.intro + STEP * 3);
  expect(game.boss!.phase).toBe('idle');
};
/** Drops the hero onto the boss from above. */
const dropOn = (game: Game): BossEvent[] => {
  const boss = game.boss!;
  Object.assign(game, { x: boss.x, z: boss.z, y: 2.4, vx: 0, vy: -3, vz: 0, grounded: false });
  const seen: BossEvent[] = [];
  for (let i = 0; i < 40; i += 1) {
    game.step(IDLE);
    for (const event of game.events) if (event.type === 'boss') seen.push(event);
    if (seen.some((event) => event.what === 'hit' || event.what === 'blocked')) break;
  }
  return seen;
};
const rest = (game: Game): void => {
  Object.assign(game.boss!, { phase: 'rest', timer: 0, attack: 'throw' });
};

describe('a boss’s arena', () => {
  it('the boss waits at home until the hero stands in its arena, then the fight begins with a moment of show', () => {
    const game = play();
    expect(run(game, {}, 2)).toEqual([]);
    expect(game.boss!.phase).toBe('waiting');
    stand(game, 11);
    const events = run(game, {}, STEP);
    expect(events[0]).toEqual({ type: 'boss', id: 'big', what: 'begin' });
    expect(phases(events)).toEqual(['intro']);
  });

  it('nothing hurts during the show, and no hit counts', () => {
    const game = play();
    stand(game, 19.2);
    run(game, {}, BOSS.intro - 0.2);
    expect(game.hearts).toBe(3);
    const events = dropOn(game);
    expect(events.some((event) => event.what === 'blocked')).toBe(true);
    expect(game.boss!.health).toBe(4);
  });

  it('a fall returns the hero to the arena’s doorstep, not its middle', () => {
    const game = play();
    stand(game, 15);
    game.step(IDLE);
    expect(game.safe).toMatchObject({ x: 11.5, z: 0, id: 'arena' });
  });
});

describe('a boss’s loop', () => {
  it('goes on watch, warns, attacks, rests, for as long as its numbers say', () => {
    const game = play();
    stand(game, 13);
    const at: Array<[BossPhase, number]> = [];
    for (let i = 0; i < 10 / STEP && at.length < 6; i += 1) {
      game.step(IDLE);
      for (const event of game.events) if (event.type === 'boss' && event.what === 'phase') at.push([event.phase, i * STEP]);
      // Step aside once the acorn is in the air.
      if (at.length === 4 && game.z === 0) stand(game, 13, 4);
    }
    expect(at.map(([phase]) => phase)).toEqual(['intro', 'idle', 'warning', 'attack', 'rest', 'idle']);
    const when = at.map(([, time]) => time);
    expect(when[1] - when[0]).toBeCloseTo(BOSS.intro, 1);
    expect(when[2] - when[1]).toBeCloseTo(NUMBERS.pause, 1);
    expect(when[3] - when[2]).toBeCloseTo(NUMBERS.warning, 1);
    expect(when[5] - when[4]).toBeCloseTo(NUMBERS.rest, 1);
  });

  it.each(['throw', 'charge', 'call'] as const)('gives a warning before every "%s"', (attack) => {
    const sidekick: EnemySpot = { id: 'bug', kind: 'mosquito', x: 14, y: 3.6, z: 0, arena: bossAt().arena, floor: 0.8, ceiling: 5, sidekickOf: 'big' };
    const game = play({ stages: [{ from: 1, attacks: [attack] }] }, 'Yaarbro', { enemies: [sidekick] });
    begin(game);
    let seen: BossPhase[] = [];
    for (let i = 0; i < 12 / STEP; i += 1) {
      // Keep well clear, walking up and down the near end.
      game.step({ ...IDLE, moveZ: Math.floor(i / 60) % 2 ? 1 : -1 });
      for (const event of game.events) if (event.type === 'boss' && event.what === 'phase') seen.push(event.phase);
      game.protectedFor = 1;
    }
    seen = seen.filter((phase) => phase === 'warning' || phase === 'attack');
    expect(seen.length).toBeGreaterThanOrEqual(4);
    seen.forEach((phase, i) => expect(phase).toBe(i % 2 === 0 ? 'warning' : 'attack'));
  });

  it('walks toward a hero who is far off while it is on watch, and never leaves its patch', () => {
    const game = play({ pause: 60 });
    begin(game, 11);
    run(game, {}, 3);
    expect(game.boss!.x).toBeLessThan(20);
    expect(game.boss!.x).toBeGreaterThanOrEqual(11 + BOSS.standoff - 0.1);
    stand(game, -8);
    run(game, {}, 20);
    expect(game.boss!.x).toBeGreaterThanOrEqual(12);
  });
});

describe('a boss’s throw', () => {
  it('goes to where the hero stood when the warning began: standing still costs a heart, stepping aside does not', () => {
    const still = play();
    begin(still);
    run(still, {}, NUMBERS.pause + NUMBERS.warning + 2);
    expect(still.hearts).toBe(2);

    const aside = play();
    begin(aside);
    run(aside, {}, NUMBERS.pause + 0.1);
    expect(aside.boss!.phase).toBe('warning');
    const aim = { ...aside.boss!.target };
    run(aside, { moveZ: 1 }, 0.6);
    run(aside, {}, 2.5);
    expect(aside.hearts).toBe(3);
    expect([aim.x, aim.z]).toEqual([13, 0]);
  });

  it('with more than one acorn, fans them out to either side of that line', () => {
    const game = play({ acorns: 3, spread: 20 });
    begin(game);
    run(game, {}, NUMBERS.pause + NUMBERS.warning + 0.3);
    game.protectedFor = 5;
    const acorns = game.boss!.acorns;
    expect(acorns).toHaveLength(3);
    // The middle one is on the line to where the hero stood; the others are either side of it.
    expect(acorns[1].to.z).toBeCloseTo(0, 5);
    expect(acorns[0].to.z * acorns[2].to.z).toBeLessThan(0);
    expect(Math.abs(acorns[0].to.z)).toBeCloseTo(Math.abs(acorns[2].to.z), 5);
  });

  it('touching it while it warns or rests does nothing; touching it on watch costs a heart', () => {
    for (const [phase, hurts] of [['warning', false], ['rest', false], ['stagger', false], ['roar', false], ['idle', true]] as const) {
      const game = play({ pause: 60 });
      begin(game);
      stand(game, 18.8);
      Object.assign(game.boss!, { phase, timer: 0, attack: 'throw', from: { x: 20, y: 1.6, z: 0 }, target: { x: 30, y: 0.8, z: 6 } });
      game.step(IDLE);
      expect(game.hearts, phase).toBe(hurts ? 2 : 3);
    }
  });
});

describe('a boss’s charge', () => {
  const CHARGE: Partial<BossNumbers> = { stages: [{ from: 1, attacks: ['charge'] }] };

  it('runs in a straight line through where the hero stood to the far side of its patch, and rests there', () => {
    const game = play(CHARGE);
    begin(game, 14);
    run(game, {}, NUMBERS.pause + 0.1);
    expect([game.boss!.phase, game.boss!.attack]).toEqual(['warning', 'charge']);
    expect([game.boss!.target.x, game.boss!.target.z]).toEqual([12, 0]);
    stand(game, 14, 5);
    const seen = phases(run(game, {}, NUMBERS.chargeWarning + 1.5));
    expect(seen).toEqual(['attack', 'rest']);
    expect(game.boss!.x).toBeCloseTo(12, 5);
    expect(game.hearts).toBe(3);
  });

  it('costs a heart to be in its way', () => {
    const game = play(CHARGE);
    begin(game, 14);
    run(game, {}, NUMBERS.pause + NUMBERS.chargeWarning + 2);
    expect(game.hearts).toBe(2);
  });

  it('aimed at a corner, still stops inside its patch', () => {
    const game = play(CHARGE);
    begin(game, 12);
    stand(game, 11, -7.5);
    run(game, {}, NUMBERS.pause + NUMBERS.chargeWarning + 0.1);
    stand(game, 26, 7);
    run(game, {}, 3);
    const { x, z } = game.boss!;
    expect(x).toBeGreaterThanOrEqual(12 - 1e-9);
    expect(z).toBeGreaterThanOrEqual(-6.5 - 1e-9);
  });
});

describe('hitting a boss', () => {
  it('a landing on top takes one from its health, staggers it, and bounces the hero up', () => {
    const game = play();
    begin(game);
    const events = dropOn(game);
    expect(events).toContainEqual({ type: 'boss', id: 'big', what: 'hit', how: 'stomp', left: 3 });
    expect(game.boss!.phase).toBe('stagger');
    expect(game.vy).toBe(BOSS.rebound);
    expect(game.hearts).toBe(3);
  });

  it('cannot be hit again until the stagger is over: a second landing bounces off', () => {
    const game = play();
    begin(game);
    dropOn(game);
    const again = dropOn(game);
    expect(again.some((event) => event.what === 'blocked')).toBe(true);
    expect(game.boss!.health).toBe(3);
    run(game, {}, BOSS.stagger);
    stand(game, 13);
    dropOn(game);
    expect(game.boss!.health).toBe(2);
  });

  it('a full jump from the ground reaches its top, with the level’s help for ledges', () => {
    const game = play({ pause: 60 }, 'Yaarbro', { ledgeHelp: 0.15 });
    begin(game);
    rest(game);
    stand(game, game.boss!.x - 3.1);
    let hit = false;
    for (let i = 0; i < 90 && !hit; i += 1) {
      game.step({ ...IDLE, moveX: 1, jump: game.vy >= 0 });
      hit = game.events.some((event) => event.type === 'boss' && event.what === 'hit');
      game.boss!.timer = 0;
    }
    expect(hit).toBe(true);
  });

  it('Yaarbro’s roll hits it while it rests', () => {
    const game = play({ pause: 60 });
    begin(game);
    rest(game);
    stand(game, 14);
    let hit = false;
    for (let i = 0; i < 200 && !hit; i += 1) {
      game.step({ ...IDLE, moveX: 1, move: true });
      game.boss!.timer = Math.min(game.boss!.timer, 0.5);
      hit = game.events.some((event) => event.type === 'boss' && event.what === 'hit' && event.how === 'roll');
    }
    expect(hit).toBe(true);
    expect(game.hearts).toBe(3);
  });

  it('Caputo’s pounce hits it while it rests, and bounces him up off it', () => {
    const game = play({ pause: 60 }, 'Caputo');
    begin(game);
    rest(game);
    stand(game, game.boss!.x - 2.6);
    game.facing = Math.PI / 2;
    let hit = false;
    for (let i = 0; i < 40 && !hit; i += 1) {
      game.step({ ...IDLE, moveX: 1, move: i === 0 });
      hit = game.events.some((event) => event.type === 'boss' && event.what === 'hit' && event.how === 'pounce');
    }
    expect(hit).toBe(true);
    expect(game.vy).toBe(BOSS.rebound);
  });
});

describe('a guarded boss', () => {
  const GUARDED: Partial<BossNumbers> = { guarded: true, pause: 60 };

  it('is open to a hit only while it rests', () => {
    const game = play(GUARDED);
    begin(game);
    expect(bossOpen(game.boss!)).toBe(false);
    rest(game);
    expect(bossOpen(game.boss!)).toBe(true);
    dropOn(game);
    expect(game.boss!.health).toBe(3);
  });

  it('on watch, a landing on top bounces off, does no harm either way, and throws the hero clear', () => {
    const game = play(GUARDED);
    begin(game);
    const boss = game.boss!;
    Object.assign(game, { x: boss.x - 0.3, z: boss.z, y: 2.4, vx: 0, vy: -3, vz: 0, grounded: false });
    const seen = run(game, {}, 0.3);
    expect(seen).toContainEqual({ type: 'boss', id: 'big', what: 'blocked' });
    expect([boss.health, game.hearts]).toEqual([4, 3]);
    run(game, {}, 1.2);
    expect(Math.hypot(game.x - boss.x, game.z - boss.z)).toBeGreaterThan(boss.spot.radius + MOVE.bodyRadius);
    expect(game.hearts).toBe(3);
  });

  it('on watch, a roll into it is only a touch: it costs a heart', () => {
    const game = play(GUARDED);
    begin(game);
    stand(game, 13);
    run(game, { moveX: 1, move: true }, 2);
    expect([game.boss!.health, game.hearts]).toEqual([4, 2]);
  });

  it('an unguarded boss can be hit on watch too', () => {
    const game = play({ pause: 60 });
    begin(game);
    expect(bossOpen(game.boss!)).toBe(true);
  });
});

describe('a boss’s stages', () => {
  it('are picked by its health', () => {
    const spot = bossAt({ health: 6, stages: [{ from: 1, attacks: ['throw'] }, { from: 0.67, attacks: ['charge'] }, { from: 0.34, attacks: ['call'] }] });
    expect([6, 5, 4, 3, 2, 1].map((health) => stageFor(spot, health))).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('a new stage is marked with a roar, in which nothing hurts, and then its attacks change', () => {
    const game = play();
    begin(game);
    dropOn(game);
    run(game, {}, BOSS.stagger + 0.1);
    stand(game, 13);
    const second = dropOn(game);
    expect(game.boss!.health).toBe(2);
    const seen = [...second, ...run(game, {}, BOSS.stagger + 0.1)];
    expect(seen).toContainEqual({ type: 'boss', id: 'big', what: 'stage', stage: 1 });
    expect(game.boss!.phase).toBe('roar');
    stand(game, game.boss!.x - 1);
    run(game, {}, BOSS.roar - 0.2);
    expect(game.hearts).toBe(3);
    stand(game, 13);
    run(game, {}, 0.3 + NUMBERS.pause + 0.1);
    expect(game.boss!.attack).toBe('charge');
  });
});

describe('beating a boss', () => {
  const beat = (game: Game): BossEvent[] => {
    begin(game);
    const seen: BossEvent[] = [];
    for (let hits = 0; hits < 4; hits += 1) {
      Object.assign(game.boss!, { phase: 'rest', timer: 0, attack: 'throw' });
      seen.push(...dropOn(game));
    }
    return seen;
  };

  it('the goal cannot be taken until the boss is beaten', () => {
    const game = play();
    expect(game.goalOpen).toBe(false);
    stand(game, 27);
    run(game, {}, 0.5);
    expect(game.complete).toBe(false);
    const seen = beat(game);
    expect(seen).toContainEqual({ type: 'boss', id: 'big', what: 'beaten' });
    expect([game.boss!.phase, game.goalOpen, game.summary().beaten]).toEqual(['defeated', true, 1]);
    stand(game, 27);
    run(game, {}, 0.2);
    expect(game.complete).toBe(true);
  });

  it('gives the hero a moment in which nothing can hurt', () => {
    const game = play();
    beat(game);
    expect(game.protectedFor).toBeGreaterThanOrEqual(BOSS.victoryProtection - 0.1);
  });

  it('a level with no boss has its goal open from the start', () => {
    expect(new Game(yard(), 'normal', 'Yaarbro').goalOpen).toBe(true);
  });
});

describe('a boss’s sidekicks', () => {
  const bug = (id: string, x: number): EnemySpot => ({ id, kind: 'mosquito', x, y: 3.6, z: 0, arena: bossAt().arena, floor: 0.8, ceiling: 5, sidekickOf: 'big' });
  const CALL: Partial<BossNumbers> = { stages: [{ from: 1, attacks: ['call'] }] };
  const withBugs = (numbers = CALL): Game => play(numbers, 'Yaarbro', { enemies: [bug('bug-1', 14), bug('bug-2', 24)] });

  it('lie low until called: unseen by the rules, harmless and untouchable', () => {
    const game = withBugs({ pause: 60 });
    begin(game);
    stand(game, 14);
    Object.assign(game, { y: 3 });
    run(game, {}, 2);
    expect(game.hearts).toBe(3);
    expect(game.enemies.map((enemy) => [enemy.dormant, enemy.hits])).toEqual([[true, 1], [true, 1]]);
  });

  it('come out when the boss calls, after its warning', () => {
    const game = withBugs();
    begin(game);
    const seen = run(game, { moveZ: 1 }, NUMBERS.pause + NUMBERS.warning + 0.2);
    expect(seen).toContainEqual({ type: 'boss', id: 'big', what: 'call' });
    expect(game.enemies.map((enemy) => enemy.dormant)).toEqual([false, false]);
  });

  it('one that was beaten comes back the next time the boss calls', () => {
    const game = withBugs();
    begin(game);
    run(game, { moveZ: 1 }, NUMBERS.pause + NUMBERS.warning + 0.2);
    Object.assign(game.enemies[0], { phase: 'defeated', hits: 0 });
    game.protectedFor = 60;
    run(game, {}, NUMBERS.rest + NUMBERS.pause + NUMBERS.warning + 1);
    expect([game.enemies[0].phase === 'defeated', game.enemies[0].hits]).toEqual([false, 1]);
  });

  it('give up when the boss is beaten', () => {
    const game = withBugs();
    begin(game);
    run(game, { moveZ: 1 }, NUMBERS.pause + NUMBERS.warning + 0.2);
    for (let hits = 0; hits < 4; hits += 1) {
      Object.assign(game.boss!, { phase: 'rest', timer: 0 });
      dropOn(game);
    }
    expect(game.boss!.phase).toBe('defeated');
    expect(game.enemies.map((enemy) => enemy.phase)).toEqual(['defeated', 'defeated']);
  });

  it('a boss with nobody to call throws instead', () => {
    const game = play(CALL);
    begin(game);
    run(game, {}, NUMBERS.pause + 0.1);
    expect(game.boss!.attack).toBe('throw');
  });
});

describe('the regen rule for a boss', () => {
  const damage = (game: Game): void => {
    begin(game);
    dropOn(game);
    expect(game.boss!.health).toBe(3);
  };

  it('a fall sends it home at full health, and the fight starts over', () => {
    const game = play();
    damage(game);
    Object.assign(game, { x: 40, z: 0 });
    const seen = run(game, {}, 3);
    expect(game.falls).toBe(1);
    expect(seen).toContainEqual({ type: 'boss', id: 'big', what: 'reset', healed: true });
    const boss = game.boss!;
    expect([boss.health, boss.x, boss.z, boss.stage]).toEqual([4, 20, 0, 0]);
    // The hero is back on the arena's doorstep; after a moment the fight begins again.
    expect(seen.filter((event) => event.what === 'begin')).toHaveLength(1);
    expect(boss.fights).toBe(2);
  });

  it('waits a moment before it begins again, so the hero has the controls first', () => {
    const game = play();
    damage(game);
    Object.assign(game, { x: 40, z: 0 });
    for (let i = 0; i < 600 && game.falls === 0; i += 1) game.step(IDLE);
    expect(game.boss!.grace).toBe(BOSS.grace);
    expect(run(game, {}, BOSS.grace - 0.1).filter((event) => event.what === 'begin')).toEqual([]);
    expect(BOSS.grace).toBeGreaterThan(MOVE.returnPause + 0.5);
  });

  it('running out of hearts does the same', () => {
    const game = play({}, 'Yaarbro', { hearts: 1 });
    damage(game);
    game.protectedFor = 0;
    expect(game.hurt(game.boss!.x, game.boss!.z)).toBe(true);
    const seen = run(game, {}, 1.5);
    expect(seen).toContainEqual({ type: 'boss', id: 'big', what: 'reset', healed: true });
    expect([game.boss!.health, game.hearts, game.falls]).toEqual([4, 1, 0]);
  });

  it('puts its sidekicks back to lying low', () => {
    const bug: EnemySpot = { id: 'bug', kind: 'mosquito', x: 14, y: 3.6, z: 0, arena: bossAt().arena, floor: 0.8, ceiling: 5, sidekickOf: 'big' };
    const game = play({ stages: [{ from: 1, attacks: ['call'] }] }, 'Yaarbro', { enemies: [bug] });
    begin(game);
    run(game, { moveZ: 1 }, NUMBERS.pause + NUMBERS.warning + 0.2);
    expect(game.enemies[0].dormant).toBe(false);
    Object.assign(game, { x: 40, z: 0 });
    for (let i = 0; i < 600 && game.falls === 0; i += 1) game.step(IDLE);
    expect(game.enemies[0].dormant).toBe(true);
  });

  it('a beaten boss stays beaten, and says nothing', () => {
    const game = play();
    begin(game);
    for (let hits = 0; hits < 4; hits += 1) {
      Object.assign(game.boss!, { phase: 'rest', timer: 0 });
      dropOn(game);
    }
    Object.assign(game, { x: 40, z: 0 });
    const seen = run(game, {}, 3);
    expect(game.falls).toBe(1);
    expect(game.boss!.phase).toBe('defeated');
    expect(seen.filter((event) => event.what === 'reset')).toEqual([]);
  });

  it('a hero sent back before the fight began changes nothing', () => {
    const game = play();
    Object.assign(game, { x: -20, z: 0 });
    const seen = run(game, {}, 3);
    expect(game.falls).toBe(1);
    expect(seen).toEqual([]);
  });
});

describe('the practice boss in the sandbox', () => {
  it('is harder on each difficulty: more health, shorter warnings and rests, faster attacks', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((difficulty) => SANDBOX_DIFFICULTY[difficulty].boss);
    expect([easy.guarded, normal.guarded, hard.guarded]).toEqual([false, true, true]);
    expect([easy.aimLine, normal.aimLine, hard.aimLine]).toEqual([true, false, false]);
    for (const [gentler, tougher] of [[easy, normal], [normal, hard]] as const) {
      expect(tougher.health).toBeGreaterThan(gentler.health);
      expect(tougher.warning).toBeLessThan(gentler.warning);
      expect(tougher.chargeWarning).toBeLessThan(gentler.chargeWarning);
      expect(tougher.rest).toBeLessThan(gentler.rest);
      expect(tougher.chargeSpeed).toBeGreaterThan(gentler.chargeSpeed);
    }
    // Even the briefest warning is one a player can answer.
    expect(hard.warning).toBeGreaterThanOrEqual(0.33);
  });

  it.each(DIFFICULTIES)('on %s it stands on its arena, with room to move, and the arena is a safe bank', (difficulty) => {
    const level = buildSandbox(difficulty);
    const boss = level.boss!;
    const arena = level.solids.find((s) => s.id === 'arena')!;
    expect(arena.safe).toBe(true);
    expect(boss.y).toBe(arena.top);
    for (const [low, high, middle, half] of [[boss.patch.minX, boss.patch.maxX, arena.x, arena.halfX], [boss.patch.minZ, boss.patch.maxZ, arena.z, arena.halfZ]] as const) {
      expect(low - boss.radius).toBeGreaterThanOrEqual(middle - half - 1e-9);
      expect(high + boss.radius).toBeLessThanOrEqual(middle + half + 1e-9);
    }
    // A full jump reaches its top.
    expect(boss.height - level.ledgeHelp).toBeLessThan((MOVE.jumpSpeed * MOVE.jumpSpeed) / (2 * MOVE.gravity) - 0.2);
  });

  describe.each(DIFFICULTIES)('on %s', (difficulty) => {
    it.each(HEROES)('the bot beats it as %s on walk and jump alone, without losing a heart, and only then takes the leaf', (hero) => {
      const played = playWithBot(new Game(buildSandbox(difficulty), difficulty, hero), 200);
      expect(played.complete).toBe(true);
      expect(played.boss!.phase).toBe('defeated');
      expect([played.heartsLost, played.falls, played.movesUsed]).toEqual([0, 0, 0]);
      expect(played.boss!.fights).toBe(1);
    });
  });
});
