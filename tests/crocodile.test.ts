// The crocodile (src/game/crocodile.ts): it lurks, stalks a hero in its
// water at their depth, gives a tell (its eyes sink and it creeps along its
// aim), lunges, and rests. The owner's rules: it reaches a hero at the surface
// and underwater, each hero's move beats it or gets past it, and the regen
// rule applies. Its place in the lake, and the bot getting past it, are
// tested with the lake (tests/lake.test.ts, tests/levels.test.ts).

import { describe, expect, it } from 'vitest';
import { CROC } from '../src/game/crocodile';
import { isDangerous, newEnemy, sendHome, type EnemySpot, type EnemyTuning } from '../src/game/enemy';
import { Game, IDLE, type Input } from '../src/game/game';
import { HEROES, STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import type { Water } from '../src/game/swim';

const SURFACE = 0;
const FLOOR = -4;
const LURK = SURFACE - CROC.lurkDepth;

const croc = (over: Partial<EnemySpot> = {}): EnemySpot => ({
  id: 'croc',
  kind: 'crocodile',
  x: 0,
  y: LURK,
  z: -18,
  arena: { minX: -9, maxX: 9, minZ: -28, maxZ: -6 },
  surface: SURFACE,
  floor: FLOOR,
  ...over,
});

/** A bank, a wide pool 24 m long with a log in it, and a bank beyond. One crocodile lurks in the middle of the pool. */
const lakeYard = (over: Partial<Level> = {}, spot: Partial<EnemySpot> = {}, tuning: Partial<EnemyTuning> = {}): Level => {
  const box = (id: string, z0: number, z1: number, x: number, halfX: number, top: number, extra: Partial<Solid> = {}): Solid => ({
    id, kind: 'bank', shape: 'box', x, z: -(z0 + z1) / 2, halfX, halfZ: (z1 - z0) / 2, top, bottom: -40, ...extra,
  });
  const water: Water = { id: 'pool', minX: -10, maxX: 10, minZ: -30, maxZ: -4, surface: SURFACE, floor: FLOOR };
  return {
    name: 'Crocodile yard',
    solids: [box('near', -2, 4, 0, 10, 0.3, { safe: true }), box('far', 30, 36, 0, 10, 0.3, { safe: true }), box('log', 20, 24, 6, 0.8, 0.5, { kind: 'log' })],
    water: [water],
    spawn: { x: 0, y: 0.3, z: 0 },
    leaf: { x: 0, y: 1.3, z: -35, radius: 0.5 },
    fallY: -8,
    coyoteTime: 0.1,
    ledgeHelp: 0.3,
    hearts: 3,
    protection: 1,
    knockback: 1.2,
    route: ['near', 'pool', 'far'],
    enemies: [croc(spot)],
    enemyTuning: { warning: 1, speed: 1, rest: 1, ...tuning },
    ...over,
  };
};

const run = (game: Game, input: Input | ((g: Game) => Input), seconds: number, until?: (g: Game) => boolean): void => {
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(typeof input === 'function' ? input(game) : input);
    if (until?.(game)) return;
  }
};

/** A hero put into the pool at (x, z), settled at the surface. The crocodile has not noticed yet: the hero is outside its water. */
const swimmer = (level: Level, x: number, z: number, hero: (typeof HEROES)[number] = 'Yaarbro'): Game => {
  const game = new Game(level, 'normal', hero);
  Object.assign(game, { x, z, y: SURFACE - 1.15, grounded: false, groundId: null });
  run(game, IDLE, 0.5);
  return game;
};

const theCroc = (game: Game) => game.enemies[0];

describe('the crocodile lurks', () => {
  it('waits at home low in the water, only eyes and snout above the surface, and touching it does nothing', () => {
    const game = swimmer(lakeYard({}, { notice: 0, arena: { minX: 8, maxX: 9, minZ: -20, maxZ: -19 } }), 0, -18);
    const c = theCroc(game);
    expect(c.phase).toBe('concealed');
    expect(c.y).toBeCloseTo(LURK);
    expect(c.y + CROC.halfHeight).toBeGreaterThan(SURFACE);
    expect(isDangerous(c)).toBe(false);
    // The hero right on top of it, outside its water: nothing happens.
    Object.assign(c, { x: game.x, z: game.z });
    run(game, IDLE, 1);
    expect(game.heartsLost).toBe(0);
  });
});

describe('the crocodile stalks a hero in its water', () => {
  it('comes after a swimmer at the surface, slower than a hero swims', () => {
    const game = swimmer(lakeYard(), 0, -8);
    const c = theCroc(game);
    const before = Math.hypot(c.x - game.x, c.z - game.z);
    run(game, IDLE, 1.2, () => c.phase === 'warning');
    expect(c.phase).not.toBe('concealed');
    expect(Math.hypot(c.x - game.x, c.z - game.z)).toBeLessThan(before);
    expect(CROC.speed).toBeLessThan(3.6);
  });

  it('follows a swimmer down: it hunts underwater too', () => {
    const game = swimmer(lakeYard(), 0, -10);
    run(game, { ...IDLE, move: true }, 1.2);
    expect(game.under).toBe(true);
    expect(theCroc(game).y).toBeLessThan(LURK - 0.5);
  });
});

describe('its tell, and the lunge', () => {
  it('fixes its aim, sinks its eyes under and creeps along the line before it lunges', () => {
    const game = swimmer(lakeYard(), 0, -13);
    const c = theCroc(game);
    run(game, IDLE, 4, () => c.phase === 'warning');
    expect(c.phase).toBe('warning');
    const aim = { ...c.target };
    const startY = c.y;
    const start = { x: c.x, z: c.z };
    run(game, IDLE, CROC.warning * 0.9, () => c.phase !== 'warning');
    expect(c.target).toEqual(aim);
    expect(c.y).toBeLessThan(startY - CROC.sink * 0.6);
    // Its eyes are under the water now.
    expect(c.y + CROC.halfHeight).toBeLessThan(SURFACE + 0.02);
    // It has crept toward its aim.
    expect(Math.hypot(aim.x - c.x, aim.z - c.z)).toBeLessThan(Math.hypot(aim.x - start.x, aim.z - start.z));
  });

  it('reaches a hero at the surface: a swimmer who stays put is bitten', () => {
    const game = swimmer(lakeYard(), 0, -13);
    run(game, IDLE, 6, () => game.heartsLost > 0);
    expect(game.heartsLost).toBe(1);
  });

  it('reaches a hero underwater: a swimmer who stays under is bitten too', () => {
    const game = swimmer(lakeYard(), 0, -13);
    run(game, { ...IDLE, move: true }, 6, () => game.heartsLost > 0);
    expect(game.under).toBe(true);
    expect(game.heartsLost).toBe(1);
  });

  it('gets no one who swims out of its line once the tell begins: the lunge goes only where it aimed', () => {
    for (const hero of HEROES) {
      const game = swimmer(lakeYard(), 0, -13, hero);
      const c = theCroc(game);
      run(game, IDLE, 4, () => c.phase === 'warning');
      // Away across its line, until it has lunged and is resting.
      run(game, { ...IDLE, moveX: 1 }, 3, () => c.phase === 'rest');
      expect(c.phase).toBe('rest');
      expect(game.heartsLost).toBe(0);
    }
  });

  it('gets no one who dives once the tell begins: the move button takes a swimmer out of a lunge aimed at the surface', () => {
    for (const hero of HEROES) {
      const game = swimmer(lakeYard(), 0, -13, hero);
      const c = theCroc(game);
      run(game, IDLE, 4, () => c.phase === 'warning');
      run(game, { ...IDLE, move: true }, 3, () => c.phase === 'rest');
      expect(c.phase).toBe('rest');
      expect(game.heartsLost).toBe(0);
    }
  });

  it('rests at the surface after a lunge, and touching it then does nothing', () => {
    const game = swimmer(lakeYard(), 0, -13);
    const c = theCroc(game);
    run(game, IDLE, 4, () => c.phase === 'warning');
    run(game, { ...IDLE, moveX: 1 }, 3, () => c.phase === 'rest');
    expect(isDangerous(c)).toBe(false);
    run(game, IDLE, CROC.rest * 0.6);
    expect(c.y).toBeGreaterThan(LURK - 0.3);
  });
});

describe('beating it', () => {
  it('landing on it from above beats it: a hero dropped onto its back', () => {
    for (const hero of HEROES) {
      const game = new Game(lakeYard(), 'normal', hero);
      const c = theCroc(game);
      Object.assign(game, { x: c.x, z: c.z, y: c.y + 3, vy: -2, grounded: false, groundId: null });
      run(game, IDLE, 1.5, () => c.phase === 'defeated');
      expect(c.phase).toBe('defeated');
      expect(game.heartsLost).toBe(0);
      expect(game.beaten).toBe(1);
    }
  });

  it("each hero's move from a log beats one lurking beside it: Yaarbro's roll, Caputo's pounce", () => {
    for (const hero of HEROES) {
      // It lurks just past the end of the log, in a patch of its own, so it is still lying low as the hero comes.
      const level = lakeYard({}, { x: 6, z: -25.5, arena: { minX: 5, maxX: 7, minZ: -27, maxZ: -25 } });
      const game = new Game(level, 'normal', hero);
      const log = level.solids.find((s) => s.id === 'log')!;
      Object.assign(game, { x: log.x, z: log.z + log.halfZ - 0.4, y: log.top, grounded: true, groundId: 'log' });
      const c = theCroc(game);
      run(game, (g) => ({ ...IDLE, moveZ: -1, move: hero === 'Yaarbro' || g.grounded }), 3, () => c.phase === 'defeated');
      expect(c.phase, hero).toBe('defeated');
      expect(game.heartsLost, hero).toBe(0);
    }
  });
});

describe('the regen rule', () => {
  it('a hero sent back to a safe bank finds every crocodile not beaten at home at full health', () => {
    const tuning = { crocHits: 2 };
    const game = new Game(lakeYard({}, {}, tuning), 'normal', 'Yaarbro');
    const c = theCroc(game);
    // One strike, from above.
    Object.assign(game, { x: c.x, z: c.z, y: c.y + 3, vy: -2, grounded: false, groundId: null });
    run(game, IDLE, 1.5, () => c.hits < 2);
    expect(c.hits).toBe(1);
    // Then the hero runs out of hearts in its jaws and goes back.
    game.hearts = 1;
    Object.assign(game, { x: 0, z: -13, y: SURFACE - 1.15, vy: 0 });
    run(game, IDLE, 8, () => game.hearts === game.level.hearts && game.grounded);
    expect(game.groundId).toBe('near');
    expect(c.hits).toBe(2);
    expect([c.x, c.z]).toEqual([c.spot.x, c.spot.z]);
  });

  it('sendHome puts it back lurking at home, and a beaten one stays beaten', () => {
    const c = newEnemy(croc(), { warning: 1, speed: 1, rest: 1, crocHits: 2 });
    Object.assign(c, { x: 3, z: -10, y: -2, phase: 'rest', hits: 1 });
    expect(sendHome(c)).toBe(true);
    expect([c.x, c.y, c.z, c.phase, c.hits]).toEqual([0, LURK, -18, 'concealed', 2]);
    c.phase = 'defeated';
    expect(sendHome(c)).toBe(false);
    expect(c.phase).toBe('defeated');
  });
});

describe('only the crocodile reaches under the water', () => {
  it('a mosquito diving at a swimmer whose head is under does not hurt', () => {
    const level = lakeYard({ enemies: [{ id: 'mozzie', kind: 'mosquito', x: 0, y: 2, z: -13, arena: { minX: -9, maxX: 9, minZ: -28, maxZ: -6 }, floor: SURFACE + 0.3 }] });
    const game = swimmer(level, 0, -13);
    run(game, { ...IDLE, move: true }, 6);
    expect(game.heartsLost).toBe(0);
  });
});
