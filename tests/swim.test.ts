// Swimming (src/game/swim.ts): going in, floating, swimming, diving, coming
// up, breath, climbing out, the pool's sides, checkpoints, and enemies near
// water. The bot swimming the sandbox pool on every difficulty as each hero is
// in tests/levels.test.ts, which runs over every level in the list.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import type { EnemySpot } from '../src/game/enemy';
import { Game, IDLE, type Input } from '../src/game/game';
import { HEROES, MOVE, STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { SWIM, climbOut, waterAt, type Water } from '../src/game/swim';
import { POOL, buildSandbox } from '../src/levels/sandbox/layout';
import { SANDBOX_DIFFICULTY } from '../src/levels/sandbox/difficulty';
import { Bot } from './helpers/bot';

const SURFACE = -0.7;
const FLOOR = -5;

/** A bank, a pool 20 m long, a bank beyond it, and a tall rock wall along the pool's right side. */
const poolLevel = (over: Partial<Level> = {}): Level => {
  const box = (id: string, z0: number, z1: number, x: number, halfX: number, top: number, extra: Partial<Solid> = {}): Solid => ({
    id, kind: 'bank', shape: 'box', x, z: -(z0 + z1) / 2, halfX, halfZ: (z1 - z0) / 2, top, bottom: -40, ...extra,
  });
  const water: Water = { id: 'pool', minX: -4, maxX: 4, minZ: -26, maxZ: -6, surface: SURFACE, floor: FLOOR };
  return {
    name: 'Pool',
    solids: [
      box('near', -2, 6, 0, 4, 0, { safe: true }),
      box('far', 26, 32, 0, 4, 0, { safe: true }),
      box('wall', 6, 26, 6, 2, 4),
    ],
    water: [water],
    spawn: { x: 0, y: 0, z: 0 },
    leaf: { x: 0, y: 1, z: -31, radius: 0.5 },
    fallY: -8,
    coyoteTime: 0.1,
    ledgeHelp: 0.3,
    hearts: 3,
    protection: 1,
    knockback: 1.2,
    route: ['near', 'pool', 'far'],
    ...over,
  };
};

const run = (game: Game, input: Input | ((g: Game) => Input), seconds: number, until?: (g: Game) => boolean): void => {
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(typeof input === 'function' ? input(game) : input);
    if (until?.(game)) return;
  }
};

/** Drops the hero into the pool at (x, z) and lets it settle at the surface. */
const swimmerAt = (level: Level, x: number, z: number, hero: 'Yaarbro' | 'Caputo' = 'Yaarbro'): Game => {
  const game = new Game(level, 'normal', hero);
  game.x = x;
  game.z = z;
  game.y = SURFACE - 0.6;
  game.grounded = false;
  game.groundId = null;
  run(game, IDLE, 2);
  return game;
};

describe('going into deep water', () => {
  it.each(HEROES)('walking off a bank into the pool is never a fall: %s swims', (hero) => {
    const game = new Game(poolLevel(), 'normal', hero);
    const events: string[] = [];
    run(game, (g) => (events.push(...g.events.map((e) => e.type)), { moveX: 0, moveZ: -1, jump: false }), 3, (g) => g.swimming);
    expect(game.swimming).toBe(true);
    expect(game.waterId).toBe('pool');
    run(game, IDLE, 3);
    expect(game.falls).toBe(0);
    expect(events.concat(game.events.map((e) => e.type))).not.toContain('fall');
  });

  it('says so with a splash, and a dive from high up plunges deeper before floating up', () => {
    const fromBank = new Game(poolLevel(), 'normal', 'Yaarbro');
    let splash = 0;
    let deepest = 0;
    run(fromBank, (g) => {
      for (const e of g.events) if (e.type === 'splash') splash = e.speed;
      deepest = Math.min(deepest, g.y);
      return { moveX: 0, moveZ: -1, jump: false };
    }, 3);
    expect(splash).toBeGreaterThan(2);
    const high = new Game(poolLevel(), 'normal', 'Yaarbro');
    high.x = 0;
    high.z = -15;
    high.y = 8;
    high.grounded = false;
    let highSplash = 0;
    let highDeepest = 0;
    run(high, (g) => {
      for (const e of g.events) if (e.type === 'splash') highSplash = e.speed;
      highDeepest = Math.min(highDeepest, g.y);
      return IDLE;
    }, 4);
    expect(highSplash).toBeGreaterThan(splash);
    expect(highDeepest).toBeLessThan(deepest);
    // Never through the floor, and back up floating afterwards.
    expect(highDeepest).toBeGreaterThanOrEqual(FLOOR);
    expect(high.y).toBeCloseTo(SURFACE - SWIM.float, 1);
    expect(high.under).toBe(false);
  });
});

describe('at the surface', () => {
  it('floats with head and shoulders out, still, and is not underwater', () => {
    const game = swimmerAt(poolLevel(), 0, -15);
    expect(game.y).toBeCloseTo(SURFACE - SWIM.float, 2);
    expect(game.y + MOVE.bodyHeight).toBeGreaterThan(SURFACE + 0.3);
    expect(game.under).toBe(false);
    const { x, z } = game;
    run(game, IDLE, 2);
    expect([game.x, game.z]).toEqual([x, z]);
  });

  it.each(HEROES)('%s swims the way the stick points, slower than walking', (hero) => {
    const game = swimmerAt(poolLevel(), 0, -10, hero);
    run(game, { moveX: 0, moveZ: -1, jump: false }, 1);
    const z0 = game.z;
    run(game, { moveX: 0, moveZ: -1, jump: false }, 1);
    expect(z0 - game.z).toBeCloseTo(SWIM.surfaceSpeed, 1);
    expect(SWIM.surfaceSpeed).toBeLessThan(MOVE.walkSpeed);
    expect(game.facing).toBeCloseTo(Math.PI, 2);
    expect(game.under).toBe(false);
  });

  it('Jump in open water does nothing: there is no leaping out', () => {
    const game = swimmerAt(poolLevel(), 0, -15);
    const y = game.y;
    run(game, { moveX: 0, moveZ: 0, jump: true }, 1);
    expect(game.swimming).toBe(true);
    expect(game.y).toBeCloseTo(y, 3);
  });

  it('the sides of the pool hold the swimmer in', () => {
    const game = swimmerAt(poolLevel(), 0, -15);
    run(game, { moveX: -1, moveZ: 0, jump: false }, 4);
    expect(game.x).toBeCloseTo(-4 + SWIM.radius, 3);
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
  });

  it('Yaarbro does not roll and Caputo does not pounce in the water: the move button dives', () => {
    for (const hero of HEROES) {
      const game = swimmerAt(poolLevel(), 0, -15, hero);
      run(game, { moveX: 0, moveZ: -1, jump: false, move: true }, 0.5);
      expect(game.rolling).toBe(false);
      expect(game.pouncing).toBe(0);
      expect(game.movesUsed).toBe(0);
      expect(game.under).toBe(true);
    }
  });
});

describe('underwater', () => {
  it('the move button dives, Jump swims up, and with neither the swimmer drifts up to the surface', () => {
    const game = swimmerAt(poolLevel(), 0, -15);
    const events: string[] = [];
    const watch = (input: Input) => (g: Game): Input => (events.push(...g.events.map((e) => e.type)), input);
    run(game, watch({ ...IDLE, move: true }), 0.8);
    expect(game.under).toBe(true);
    expect(game.bodyHeight).toBe(SWIM.underHeight);
    const deep = game.y;
    expect(deep).toBeLessThan(SURFACE - SWIM.float - 1.5);
    // Drifting up is slow; swimming up is quicker.
    const drift = swimmerAt(poolLevel(), 0, -15);
    run(drift, { ...IDLE, move: true }, 0.8);
    run(drift, IDLE, 0.5);
    run(game, watch({ ...IDLE, jump: true }), 0.5);
    expect(game.y - deep).toBeGreaterThan(drift.y - deep + 0.5);
    run(game, watch(IDLE), 4);
    expect(game.under).toBe(false);
    expect(game.y).toBeCloseTo(SURFACE - SWIM.float, 2);
    expect(events).toContain('dive');
    expect(events).toContain('surface');
  });

  it('swims a little faster than at the surface, and never through the floor', () => {
    const game = swimmerAt(poolLevel(), 0, -8);
    run(game, { moveX: 0, moveZ: -1, jump: false, move: true }, 3);
    expect(game.y).toBeCloseTo(FLOOR + SWIM.aboveFloor, 3);
    expect(Math.abs(game.vz)).toBeCloseTo(SWIM.underSpeed, 1);
    expect(SWIM.underSpeed).toBeGreaterThan(SWIM.surfaceSpeed);
  });

  it('a rock across the water is passed under, not through', () => {
    const level = buildSandbox('normal');
    const arch = level.solids.find((s) => s.id === 'pool-arch')!;
    const pool = level.water![0];
    const game = new Game(level, 'normal', 'Yaarbro');
    game.x = 0;
    game.z = arch.z + arch.halfZ + 2;
    game.y = pool.surface - 0.6;
    game.grounded = false;
    run(game, IDLE, 2);
    // At the surface it stops against the rock.
    run(game, { moveX: 0, moveZ: -1, jump: false }, 3);
    expect(game.z).toBeGreaterThanOrEqual(arch.z + arch.halfZ + SWIM.radius - 1e-6);
    // Diving takes it under and through.
    run(game, { moveX: 0, moveZ: -1, jump: false, move: true }, 3);
    expect(game.z).toBeLessThan(arch.z - arch.halfZ);
  });
});

describe('breath', () => {
  it('runs down underwater and fills again at the surface', () => {
    const game = swimmerAt(poolLevel({ breath: 10 }), 0, -15);
    expect(game.breath).toBe(10);
    run(game, { ...IDLE, move: true }, 4);
    expect(game.breath).toBeCloseTo(10 - 4 + 0.25, 0);
    run(game, IDLE, 5);
    expect(game.under).toBe(false);
    expect(game.breath).toBe(10);
  });

  it('on Easy it never runs out; Hard gives less than Normal', () => {
    expect(SANDBOX_DIFFICULTY.easy.breath).toBeUndefined();
    expect(buildSandbox('easy').breath).toBeUndefined();
    expect(SANDBOX_DIFFICULTY.normal.breath!).toBeGreaterThan(SANDBOX_DIFFICULTY.hard.breath!);
    const game = swimmerAt(poolLevel({ breath: undefined }), 0, -15);
    run(game, { ...IDLE, move: true }, 60);
    expect(game.under).toBe(true);
    expect(game.breath).toBe(Infinity);
    expect(game.hearts).toBe(3);
  });

  it.each(DIFFICULTIES.filter((d) => d !== 'easy'))('on %s, the dive under the sandbox arch takes well under the breath there is', (difficulty) => {
    // Diving from the surface beside the arch to the surface beyond it.
    const breath = SANDBOX_DIFFICULTY[difficulty].breath!;
    const under = (POOL.surface - SWIM.float - (POOL.archBottom - SWIM.underHeight)) / SWIM.diveSpeed + 6 / SWIM.underSpeed + 2;
    expect(under).toBeLessThan(breath / 2);
  });

  it('running out is the same as losing the last heart: a moment down, then back to the last checkpoint with every heart', () => {
    const level = poolLevel({ breath: 3 });
    const game = new Game(level, 'normal', 'Yaarbro');
    // From the near bank (a checkpoint) into the pool, and down.
    run(game, { moveX: 0, moveZ: -1, jump: false }, 3, (g) => g.swimming);
    game.hurt(game.x + 1, game.z);
    run(game, IDLE, 2);
    expect(game.hearts).toBe(2);
    const events: string[] = [];
    run(game, (g) => (events.push(...g.events.map((e) => e.type)), { ...IDLE, move: true }), 6, (g) => g.grounded);
    events.push(...game.events.map((e) => e.type));
    expect(events).toContain('breathless');
    expect(events).toContain('restored');
    expect(game.swimming).toBe(false);
    expect(game.grounded).toBe(true);
    expect(game.groundId).toBe('near');
    expect(game.hearts).toBe(3);
    expect(game.breath).toBe(3);
    expect(game.falls).toBe(0);
  });
});

describe('climbing out', () => {
  it.each(HEROES)('%s climbs out with Jump at a bank low enough to reach, and it counts as reaching it', (hero) => {
    const game = swimmerAt(poolLevel(), 0, -24.5, hero);
    const events: string[] = [];
    run(game, (g) => (events.push(...g.events.map((e) => e.type)), { moveX: 0, moveZ: -1, jump: true }), 2, (g) => g.grounded);
    events.push(...game.events.map((e) => e.type));
    expect(events).toContain('climb');
    expect(game.grounded).toBe(true);
    expect(game.groundId).toBe('far');
    expect(game.y).toBe(0);
    expect(game.swimming).toBe(false);
    expect(game.safe.id).toBe('far');
    expect(events).toContain('safe');
  });

  it('takes a moment, with the controls taken, and goes up before across', () => {
    const game = swimmerAt(poolLevel(), 0, -25.5);
    run(game, { moveX: 0, moveZ: -1, jump: true }, STEP * 2);
    expect(game.climbing).toBeGreaterThan(0);
    const steps = Math.round(SWIM.climbTime / STEP);
    const path: Array<{ y: number; z: number }> = [];
    run(game, (g) => (path.push({ y: g.y, z: g.z }), { moveX: 1, moveZ: 0, jump: false }), STEP * steps);
    expect(game.grounded).toBe(true);
    const half = path[Math.floor(path.length / 2)];
    expect(half.y).toBeGreaterThan(-0.4);
    expect(game.x).toBeCloseTo(0, 6);
  });

  it('cannot climb a wall too high to reach, nor out with nothing beside it', () => {
    const atWall = swimmerAt(poolLevel(), 3.5, -15);
    run(atWall, { moveX: 1, moveZ: 0, jump: true }, 2);
    expect(atWall.swimming).toBe(true);
    expect(climbOut(poolLevel().solids, poolLevel().water![0], 3.5, -15, null)).toBeNull();
    expect(SWIM.climbHeight).toBeLessThan(4 - SURFACE);
  });

  it('walks out onto a shore no higher than the water', () => {
    const level = poolLevel();
    level.solids.push({ id: 'shore', kind: 'bank', shape: 'box', x: 0, z: -18, halfX: 4, halfZ: 1, top: SURFACE + 0.2, bottom: -40 });
    const game = swimmerAt(level, 0, -14);
    run(game, { moveX: 0, moveZ: -1, jump: false }, 4, (g) => g.grounded);
    expect(game.groundId).toBe('shore');
  });
});

describe('checkpoints and water', () => {
  it('water is never a checkpoint: swimming leaves the last safe bank as the place to go back to', () => {
    const level = poolLevel();
    const game = new Game(level, 'normal', 'Yaarbro');
    run(game, { moveX: 0, moveZ: -1, jump: false }, 6);
    expect(game.swimming).toBe(true);
    expect(waterAt(level.water, game.x, game.z)?.id).toBe('pool');
    expect(game.safe.id).toBe('near');
  });

  it('a hero sent back is out of the water with full breath', () => {
    const game = swimmerAt(poolLevel({ breath: 8, hearts: 1 }), 0, -15);
    run(game, { ...IDLE, move: true }, 2);
    // Out of hearts while underwater (nothing there can hurt it, so this stands for anything at all).
    game.hurt(game.x, game.z);
    run(game, IDLE, 2, (g) => g.grounded);
    expect(game.swimming).toBe(false);
    expect(game.breath).toBe(8);
  });
});

describe('enemies and water', () => {
  const mosquitoOverPool: EnemySpot = {
    id: 'mosquito-pool', kind: 'mosquito', x: 0, y: SURFACE + 2.5, z: -15,
    arena: { minX: -4, maxX: 4, minZ: -26, maxZ: -6 }, floor: SURFACE + 0.2, ceiling: SURFACE + 5,
  };

  it('a mosquito over the water can reach a swimmer at the surface', () => {
    const game = swimmerAt(poolLevel({ enemies: [mosquitoOverPool], enemyTuning: { warning: 1, speed: 1, rest: 1 } }), 0, -15);
    run(game, IDLE, 12, (g) => g.heartsLost > 0);
    expect(game.heartsLost).toBe(1);
  });

  it('but never a swimmer whose head is underwater', () => {
    const game = new Game(poolLevel({ enemies: [mosquitoOverPool], enemyTuning: { warning: 1, speed: 1, rest: 1 } }), 'normal', 'Yaarbro');
    game.x = 0;
    game.z = -15;
    game.y = SURFACE - 0.6;
    game.grounded = false;
    let dives = 0;
    run(game, (g) => {
      dives += g.events.filter((e) => e.type === 'enemy' && e.phase === 'attack').length;
      return { ...IDLE, move: g.y > FLOOR + 1.5 };
    }, 15);
    expect(dives).toBeGreaterThan(0);
    expect(game.under).toBe(true);
    expect(game.heartsLost).toBe(0);
  });
});

describe('the bot in the sandbox pool', () => {
  it.each(DIFFICULTIES.flatMap((d) => HEROES.map((h) => [d, h] as const)))('on %s as %s: in, under the arch with the move button, up, and out', (difficulty, hero) => {
    const game = new Game(buildSandbox(difficulty), difficulty, hero);
    const bot = new Bot(game.level);
    const seen: string[] = [];
    let dived = false;
    for (let i = 0; i < 60 / STEP && game.groundId !== 'bank-pool'; i += 1) {
      const input = bot.input(game);
      if (game.swimming && input.move) dived = true;
      game.step(input);
      for (const e of game.events) if (['splash', 'dive', 'surface', 'climb', 'breathless'].includes(e.type) && seen[seen.length - 1] !== e.type) seen.push(e.type);
    }
    expect(game.groundId).toBe('bank-pool');
    expect(dived).toBe(true);
    expect(seen[0]).toBe('splash');
    expect(seen).toContain('dive');
    expect(seen).toContain('surface');
    expect(seen[seen.length - 1]).toBe('climb');
    expect(seen).not.toContain('breathless');
    expect([game.falls, game.heartsLost]).toEqual([0, 0]);
  });
});
