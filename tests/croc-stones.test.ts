// Crocodile stepping stones (the `float` kind in src/game/moving.ts): they
// lie low until a hero comes near, hold from the first step on them, go
// under, and on Hard snap at a hero who stays. Then the lake's own crossing.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { FLOAT_LOW, type Motion } from '../src/game/moving';
import { SWIM } from '../src/game/swim';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { buildLake } from '../src/levels/cocolalla/layout';
import { Bot } from './helpers/bot';

type Float = Extract<Motion, { kind: 'float' }>;
const FLOAT: Float = { kind: 'float', wake: 8, rise: 0.5, hold: 2, tell: 0.8, snap: false, down: 2 };

/** A rock, one crocodile's back 12 m from the start, and deep water under everything. */
const yard = (motion: Partial<Float> = {}): Level => {
  const rock: Solid = { id: 'rock', kind: 'boulder', shape: 'round', x: 0, z: 0, halfX: 2, halfZ: 2, top: 0.6, bottom: -40, safe: true };
  const back: Solid = { id: 'back', kind: 'log', shape: 'box', x: 0, z: -12, halfX: 1.5, halfZ: 0.6, top: 0.4, bottom: -0.5, motion: { ...FLOAT, ...motion } };
  return {
    name: 'yard', solids: [rock, back], spawn: { x: 0, y: 0.6, z: 0 }, leaf: { x: 0, y: 2, z: -30, radius: 0.7 },
    water: [{ id: 'pool', minX: -20, maxX: 20, minZ: -40, maxZ: 20, surface: 0, floor: -4 }],
    fallY: -8, coyoteTime: 0.1, ledgeHelp: 0.3, hearts: 3, protection: 1, knockback: 1, route: ['rock', 'back'],
  };
};
const backOf = (game: Game): Solid => game.level.solids.find((s) => s.id === 'back')!;
/** Stands the hero on the back, as if it had just landed there. */
const standOnBack = (game: Game): void => {
  const back = backOf(game);
  Object.assign(game, { x: back.x, z: back.z, y: back.top, vx: 0, vy: 0, vz: 0, grounded: true, groundId: 'back', swimming: false });
};
const wait = (game: Game, seconds: number): string[] => {
  const seen: string[] = [];
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(IDLE);
    for (const event of game.events) if (event.type === 'piece') seen.push(event.what);
  }
  return seen;
};
/** Brings the hero near, so the crocodile comes up, and stands them on it. */
const upAndOn = (motion: Partial<Float> = {}): Game => {
  const game = new Game(yard(motion), 'normal', 'Yaarbro');
  Object.assign(game, { z: -6 });
  // In the air near it for a moment is enough: it only has to notice.
  for (let i = 0; i < 0.7 / STEP; i += 1) {
    Object.assign(game, { x: 0, y: 3, z: -6, vy: 0 });
    game.step(IDLE);
  }
  expect(backOf(game).gone).toBe(false);
  standOnBack(game);
  return game;
};

describe('a crocodile stepping stone', () => {
  it('lies low, not there to stand on, while no hero is near', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    wait(game, 3);
    const back = backOf(game);
    expect(back.gone).toBe(true);
    expect(back.top).toBeCloseTo(0.4 - FLOAT_LOW);
  });

  it('comes up when a hero comes near, and its back is then where the rules say it floats', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    const seen: string[] = [];
    for (let i = 0; i < 1 / STEP; i += 1) {
      Object.assign(game, { x: 0, y: 3, z: -6, vy: 0 });
      game.step(IDLE);
      for (const event of game.events) if (event.type === 'piece') seen.push(event.what);
    }
    expect(seen).toEqual(['back']);
    expect(backOf(game).gone).toBe(false);
    expect(backOf(game).top).toBeCloseTo(0.4);
  });

  it('holds from the first step on it, warns, then goes under and drops the hero into the water: never a fall', () => {
    const game = upAndOn();
    // Still up, and silent, until its warning.
    expect(wait(game, 1.1)).toEqual([]);
    expect(game.groundId).toBe('back');
    // The warning comes `tell` before the end of its hold.
    expect(wait(game, 0.2)).toEqual(['tell']);
    expect(backOf(game).piece?.telling).toBe(true);
    expect(wait(game, 2)).toContain('fall');
    expect(backOf(game).gone).toBe(true);
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
    expect(game.heartsLost).toBe(0);
  });

  it('keeps counting once stepped on, even if the hero hops off: nobody resets it by leaving', () => {
    const game = upAndOn();
    wait(game, 0.3);
    // Off it, but still near.
    for (let i = 0; i < 2.4 / STEP; i += 1) {
      Object.assign(game, { x: 0, y: 3, z: -8, vy: 0, grounded: false, groundId: null });
      game.step(IDLE);
    }
    expect(backOf(game).gone).toBe(true);
  });

  it('comes up again after its time under, while a hero is still near', () => {
    const game = upAndOn();
    wait(game, 3);
    expect(backOf(game).gone).toBe(true);
    // The swimmer treads water beside it.
    const seen = wait(game, 3);
    expect(seen).toContain('back');
    expect(backOf(game).gone).toBe(false);
  });

  it('cannot be climbed onto from the water', () => {
    const game = upAndOn({ hold: Infinity });
    const back = backOf(game);
    Object.assign(game, { x: back.x, z: back.z + back.halfZ + 0.6, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'pool' });
    for (let i = 0; i < 2 / STEP; i += 1) game.step({ ...IDLE, moveZ: -1, jump: i % 20 < 10 });
    expect(game.swimming).toBe(true);
    expect(game.climbing).toBe(0);
  });

  it('with no hold set (Easy) it never goes under while a hero stands on it', () => {
    const game = upAndOn({ hold: Infinity });
    expect(wait(game, 30)).toEqual([]);
    expect(game.groundId).toBe('back');
  });

  it('with snap (Hard), a hero still on it when its hold runs out is bitten: a heart, and thrown off', () => {
    const game = upAndOn({ snap: true, hold: 1, tell: 0.5 });
    const seen = wait(game, 1.2);
    expect(seen).toEqual(['tell', 'snap', 'fall']);
    expect(game.heartsLost).toBe(1);
    expect(game.groundId).toBeNull();
  });

  it('with snap, a hero who has hopped off in time is not bitten', () => {
    const game = upAndOn({ snap: true, hold: 1, tell: 0.5 });
    wait(game, 0.4);
    for (let i = 0; i < 1.5 / STEP; i += 1) {
      Object.assign(game, { x: 0, y: 3, z: -8, vy: 0, grounded: false, groundId: null });
      game.step(IDLE);
    }
    expect(game.heartsLost).toBe(0);
  });

  it('a hero sent back to a safe bank finds it lying low again', () => {
    const game = upAndOn();
    wait(game, 0.5);
    Object.assign(game, { x: 30, z: 30, y: -20, swimming: false, grounded: false, groundId: null });
    for (let i = 0; i < 1 / STEP && game.falls === 0; i += 1) game.step(IDLE);
    expect(game.falls).toBe(1);
    expect(backOf(game).gone).toBe(true);
  });
});

describe("the lake's crocodile crossing", () => {
  const stones = (level: Level): Solid[] => level.solids.filter((s) => s.motion?.kind === 'float');

  it('is two rows of crocodiles up the east channel with a rock between, each a jump from the last', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const row = stones(level);
      expect(row.length, difficulty).toBeGreaterThanOrEqual(6);
      const at = level.route.indexOf('point');
      const crossing = level.route.slice(at + 1, level.route.indexOf('island'));
      expect(crossing.filter((id) => id.startsWith('stone-')).length).toBe(row.length);
      expect(crossing).toContain('mid-rock');
      // It runs north: every piece is further up the channel than the one before.
      const line = ['point', ...crossing, 'island'].map((id) => level.solids.find((s) => s.id === id)!);
      for (let i = 1; i < line.length; i += 1) {
        expect(line[i].z, line[i].id).toBeLessThan(line[i - 1].z);
        const gap = line[i - 1].z - line[i - 1].halfZ - (line[i].z + line[i].halfZ);
        expect(gap, line[i].id).toBeGreaterThan(0.5);
        expect(gap, line[i].id).toBeLessThan(3.6);
      }
    }
  });

  it('on Easy they stay up, so timing does not matter; on Normal they sink; on Hard they sink fast and snap (the owner\'s rules)', () => {
    const [e, n, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d]);
    expect(e.stoneHold).toBeUndefined();
    expect(stones(buildLake('easy')).every((s) => (s.motion as Float).hold === Infinity)).toBe(true);
    expect(n.stoneHold!).toBeGreaterThan(h.stoneHold!);
    expect([e.stoneSnap, n.stoneSnap, h.stoneSnap]).toEqual([false, false, true]);
    expect(e.stoneGap).toBeLessThan(n.stoneGap);
    expect(n.stoneGap).toBeLessThan(h.stoneGap);
    // A hop from one back to the next takes about 0.7 s: even Hard's hold leaves room for it.
    expect(h.stoneHold!).toBeGreaterThan(0.9);
  });

  it('they are all up before a hero can reach them, and the hero lands on each', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const game = new Game(level, difficulty, 'Yaarbro');
      const bot = new Bot(level);
      const stood = new Set<string>();
      for (let i = 0; i < 120 / STEP && game.groundId !== 'island'; i += 1) {
        game.step(bot.input(game));
        if (game.groundId?.startsWith('stone-')) stood.add(game.groundId);
      }
      expect(game.groundId, difficulty).toBe('island');
      expect(stood.size, difficulty).toBe(stones(level).length);
      expect(game.heartsLost, difficulty).toBe(0);
    }
  });

  it('the rock island cannot be climbed onto from the channel, the rock half way can, and a hero who misses a rope has a low step to climb back by', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const top = (id: string): number => level.solids.find((s) => s.id === id)!.top;
      expect(top('island')).toBeGreaterThan(SWIM.climbHeight);
      expect(top('mid-rock')).toBeLessThanOrEqual(SWIM.climbHeight);
      expect(top('island-step')).toBeLessThanOrEqual(SWIM.climbHeight);
      // From the step, a jump reaches the island's top.
      expect(top('island') - top('island-step')).toBeLessThan(1.8);
      // The step is in the cove's water, not the channel's.
      const step = level.solids.find((s) => s.id === 'island-step')!;
      const cove = level.water!.find((w) => w.id === 'cove-water')!;
      expect(step.x + step.halfX).toBeLessThanOrEqual(cove.maxX + 1e-6);
    }
  });

  it('standing still on one: Easy holds, Normal drops the hero in the water unhurt, Hard snaps', () => {
    const outcome = (difficulty: (typeof DIFFICULTIES)[number]): { swimming: boolean; lost: number; on: string | null } => {
      const level = buildLake(difficulty);
      const game = new Game(level, difficulty, 'Caputo');
      const bot = new Bot(level);
      for (let i = 0; i < 120 / STEP && game.groundId !== 'stone-2'; i += 1) game.step(bot.input(game));
      expect(game.groundId).toBe('stone-2');
      for (let i = 0; i < 6 / STEP; i += 1) game.step(IDLE);
      return { swimming: game.swimming, lost: game.heartsLost, on: game.groundId };
    };
    expect(outcome('easy')).toEqual({ swimming: false, lost: 0, on: 'stone-2' });
    expect(outcome('normal')).toMatchObject({ swimming: true, lost: 0 });
    expect(outcome('hard').lost).toBe(1);
  });

  it.each(HEROES)('a hero who falls in swims to a rock, climbs out and goes on to the end, as %s', (hero) => {
    const level = buildLake('normal');
    const game = new Game(level, 'normal', hero);
    const bot = new Bot(level);
    for (let i = 0; i < 120 / STEP && game.groundId !== 'stone-3'; i += 1) game.step(bot.input(game));
    // Stand until it goes under.
    for (let i = 0; i < 6 / STEP && !game.swimming; i += 1) game.step(IDLE);
    expect(game.swimming).toBe(true);
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) game.step(bot.input(game));
    expect(game.complete).toBe(true);
    expect(game.falls).toBe(0);
  });
});
