// Cocolalla Lake: its sections, how long a perfect run takes, what each
// difficulty changes, and the lake's own rules: a missed jump lands in the
// water, the high banks cannot be climbed onto from it, and the rocky point
// can only be passed underwater. Times come from the bot, which plays by the
// same rules a player does. `LAKE_TIMES=1 npx vitest run tests/lake.test.ts
// --silent=false` prints when a perfect run reaches the end of each section.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { SWIM, passageNear } from '../src/game/swim';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { LAKE_SHAPE, buildLake } from '../src/levels/cocolalla/layout';
import { Bot } from './helpers/bot';

const byId = (level: Level, id: string): Solid => {
  const found = level.solids.find((s) => s.id === id);
  if (!found) throw new Error(`No solid called ${id}`);
  return found;
};

/** A clean run by the bot: the time each solid was first stood on, the longest stretch underwater, and the finish time. */
const cleanRun = (difficulty: Difficulty, hero: (typeof HEROES)[number] = 'Yaarbro') => {
  const level = buildLake(difficulty);
  const game = new Game(level, difficulty, hero);
  const bot = new Bot(level);
  const reached = new Map<string, number>([[level.route[0], 0]]);
  let under = 0;
  let longestUnder = 0;
  for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
    game.step(bot.input(game));
    for (const id of [game.groundId, game.waterId]) if (id && !reached.has(id)) reached.set(id, game.seconds);
    under = game.under ? under + STEP : 0;
    longestUnder = Math.max(longestUnder, under);
  }
  expect(game.complete).toBe(true);
  expect(game.falls).toBe(0);
  return { level, reached, seconds: game.seconds, longestUnder };
};

/** How long a perfect run of the whole lake should take on each difficulty, in seconds. The owner asked for about a minute on Normal. */
const RUN_TIME: Record<Difficulty, [number, number]> = {
  easy: [40, 60],
  normal: [52, 68],
  hard: [58, 80],
};

describe('the six sections', () => {
  it('are the ones in the route plan, on every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      expect((buildLake(difficulty).sections ?? []).map((s) => s.name)).toEqual([
        'The Shore Path',
        'The Reed Shallows',
        'The Sunken Logs',
        'The Rock Tunnel',
        'Cattail Cove',
        'The Old Pier',
      ]);
    }
  });
});

describe.each(DIFFICULTIES)('the lake on %s', (difficulty) => {
  const { level, reached, seconds, longestUnder } = cleanRun(difficulty);
  const sections = level.sections ?? [];

  if (process.env.LAKE_TIMES) {
    const ends = sections.map((s) => `${s.name} ${(reached.get(s.solids[s.solids.length - 1]) ?? seconds).toFixed(1)}`);
    console.log(`${difficulty}: ${ends.join(', ')}; leaf ${seconds.toFixed(1)} s; longest underwater ${longestUnder.toFixed(1)} s`);
  }

  it('a perfect run takes about as long as planned', () => {
    expect(seconds).toBeGreaterThan(RUN_TIME[difficulty][0]);
    expect(seconds).toBeLessThan(RUN_TIME[difficulty][1]);
  });

  it('every section is a few seconds long, and none takes over the run', () => {
    let last = 0;
    for (const section of sections) {
      const end = reached.get(section.solids[section.solids.length - 1]) ?? seconds;
      expect(end - last, section.name).toBeGreaterThan(3);
      expect(end - last, section.name).toBeLessThan(20);
      last = end;
    }
  });

  it('the dive through the rocky point is well under half the breath there is', () => {
    expect(longestUnder).toBeGreaterThan(0.5);
    if (level.breath !== undefined) expect(longestUnder).toBeLessThan(level.breath / 2);
    else expect(difficulty).toBe('easy');
  });

  it('the rocky point runs right across the lake, too high to climb onto, with the only way past under its middle', () => {
    const pool = (level.water ?? []).find((w) => w.id === 'point-water')!;
    const parts = ['rock-left', 'rock-tunnel', 'rock-right'].map((id) => byId(level, id));
    expect(Math.min(...parts.map((s) => s.x - s.halfX))).toBeCloseTo(pool.minX);
    expect(Math.max(...parts.map((s) => s.x + s.halfX))).toBeCloseTo(pool.maxX);
    for (const s of parts) expect(s.top - pool.surface).toBeGreaterThan(SWIM.climbHeight);
    const tunnel = byId(level, 'rock-tunnel');
    expect(tunnel.bottom - pool.floor).toBeGreaterThan(1);
    expect(passageNear(level.solids, pool, tunnel.x, tunnel.z + tunnel.halfZ + 1.5)).toBe(true);
    // Well past where a running jump in from the gravel bar lands.
    const bar = byId(level, 'gravel-bar');
    expect(bar.z - bar.halfZ - (tunnel.z + tunnel.halfZ)).toBeGreaterThan(8);
  });

  it('the gravel bar and the boardwalk cannot be climbed onto from the water, the shores and the first post can', () => {
    for (const id of ['gravel-bar', 'boardwalk', 'dock']) expect(byId(level, id).top - LAKE_SHAPE.surface, id).toBeGreaterThan(SWIM.climbHeight);
    for (const id of ['point', 'island', 'reed-bar', 'post-1', 'log-1']) expect(byId(level, id).top - LAKE_SHAPE.surface, id).toBeLessThanOrEqual(SWIM.climbHeight);
  });

  it('a missed jump lands in the lake, never a fall, and the hero climbs back out to go on', () => {
    const game = new Game(level, difficulty, 'Caputo');
    const bot = new Bot(level);
    for (let i = 0; i < 300 / STEP && game.groundId !== 'log-1'; i += 1) game.step(bot.input(game));
    expect(game.groundId).toBe('log-1');
    // Walk off the side of the log.
    for (let i = 0; i < 5 / STEP && !game.swimming; i += 1) game.step({ ...IDLE, moveX: -1 });
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
    // The bot swims back, climbs out (onto the island or a log) and finishes.
    let climbedOnto: string | null = null;
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
      const wasSwimming = game.swimming || game.climbing > 0;
      game.step(bot.input(game));
      if (wasSwimming && climbedOnto === null && game.grounded) climbedOnto = game.groundId;
    }
    expect(climbedOnto).toMatch(/^(island|log-|step-)/);
    expect(game.complete).toBe(true);
    expect(game.falls).toBe(0);
  });
});

describe('what each difficulty changes', () => {
  it('Easy never runs out of breath; Hard has less of it than Normal and a longer dive', () => {
    expect(LAKE_DIFFICULTY.easy.breath).toBeUndefined();
    expect(LAKE_DIFFICULTY.hard.breath!).toBeLessThan(LAKE_DIFFICULTY.normal.breath!);
    expect(LAKE_DIFFICULTY.easy.tunnelLength).toBeLessThan(LAKE_DIFFICULTY.normal.tunnelLength);
    expect(LAKE_DIFFICULTY.normal.tunnelLength).toBeLessThan(LAKE_DIFFICULTY.hard.tunnelLength);
  });

  it('the swims, the gaps and the footing all get harder from Easy to Hard', () => {
    const [e, n, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d]);
    for (const key of ['reedSwim', 'coveSwim', 'boulderGap', 'logGap', 'postGap'] as const) {
      expect(e[key], key).toBeLessThan(n[key]);
      expect(n[key], key).toBeLessThan(h[key]);
    }
    for (const key of ['boulderRadius', 'logWidth', 'postRadius', 'hearts'] as const) {
      expect(e[key], key).toBeGreaterThan(n[key]);
      expect(n[key], key).toBeGreaterThan(h[key]);
    }
  });

  it('the crocodile stretches are open water, wide enough to swim round a crocodile', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      for (const id of ['reed-water', 'cove-water']) {
        const pool = level.water!.find((w) => w.id === id)!;
        expect(pool.maxX - pool.minX, id).toBeGreaterThan(30);
      }
    }
  });
});
