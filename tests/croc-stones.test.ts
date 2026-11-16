// Crocodile stepping stones (the `float` kind in src/game/moving.ts): a row
// lies under the water until a hero comes near its first crocodile; then they
// surface one after another, a wave along the row, and keep that rhythm
// (Normal and Hard) or stay up (Easy). A back dips under a hero, and on Hard
// one stood on too long snaps. Then the lake's own crossing.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, MOVE, STEP } from '../src/game/hero';
import { touchesFromAbove, type Level, type Solid } from '../src/game/level';
import { FLOAT_LOW, floatPhase, type Motion } from '../src/game/moving';
import { SWIM } from '../src/game/swim';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { buildLake } from '../src/levels/cocolalla/layout';
import { cameraFor } from '../src/view/route-camera';
import { stoneLength } from '../src/view/croc-stones';
import { Bot } from './helpers/bot';

type Float = Extract<Motion, { kind: 'float' }>;
const FLOAT: Float = { kind: 'float', wake: 8, from: { x: 0, z: -12 }, delay: 0, rise: 0.5, up: 2.5, period: 6, tell: 0.8, dip: 0.12, snap: Infinity };

/** A rock, a row of two crocodiles' backs from 12 m out, and deep water under everything. */
const yard = (motion: Partial<Float> = {}): Level => {
  const rock: Solid = { id: 'rock', kind: 'boulder', shape: 'round', x: 0, z: 0, halfX: 2, halfZ: 2, top: 0.6, bottom: -40, safe: true };
  const back: Solid = { id: 'back', kind: 'log', shape: 'box', x: 0, z: -12, halfX: 1.5, halfZ: 0.6, top: 0.4, bottom: -0.15, motion: { ...FLOAT, ...motion } };
  const next: Solid = { id: 'next', kind: 'log', shape: 'box', x: 0, z: -15, halfX: 1.5, halfZ: 0.6, top: 0.4, bottom: -0.15, motion: { ...FLOAT, ...motion, delay: 0.9 } };
  return {
    name: 'yard', solids: [rock, back, next], spawn: { x: 0, y: 0.6, z: 0 }, leaf: { x: 0, y: 2, z: -30, radius: 0.7 },
    water: [{ id: 'pool', minX: -20, maxX: 20, minZ: -40, maxZ: 20, surface: 0, floor: -4 }],
    fallY: -8, coyoteTime: 0.1, ledgeHelp: 0.3, hearts: 3, protection: 1, knockback: 1, route: ['rock', 'back', 'next'],
  };
};
const solidOf = (game: Game, id = 'back'): Solid => game.level.solids.find((s) => s.id === id)!;
/** Stands the hero on the back, as if it had just landed there. */
const standOnBack = (game: Game): void => {
  const back = solidOf(game);
  Object.assign(game, { x: back.x, z: back.z, y: back.top, vx: 0, vy: 0, vz: 0, grounded: true, groundId: 'back', swimming: false });
};
const wait = (game: Game, seconds: number, id?: string): string[] => {
  const seen: string[] = [];
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(IDLE);
    for (const event of game.events) if (event.type === 'piece' && (!id || event.id === id)) seen.push(event.what);
  }
  return seen;
};
/** Holds the hero in the air near the row for a while: it only has to notice. */
const hover = (game: Game, seconds: number, z = -6): string[] => {
  const seen: string[] = [];
  for (let i = 0; i < seconds / STEP; i += 1) {
    Object.assign(game, { x: 0, y: 3, z, vy: 0, grounded: false, groundId: null });
    game.step(IDLE);
    for (const event of game.events) if (event.type === 'piece') seen.push(`${event.id}:${event.what}`);
  }
  return seen;
};
/** Wakes the row, waits for the first crocodile to be up, and stands the hero on it. */
const upAndOn = (motion: Partial<Float> = {}): Game => {
  const game = new Game(yard(motion), 'normal', 'Yaarbro');
  hover(game, 0.6);
  expect(solidOf(game).gone).toBe(false);
  standOnBack(game);
  return game;
};

describe('a row that waits for the first step (Normal)', () => {
  const waiting = (): Game => new Game(yard({ waitFor: 'back' }), 'normal', 'Yaarbro');

  it('only its first crocodile comes up when a hero is near, and stays up however long the hero waits', () => {
    const game = waiting();
    hover(game, 1);
    expect(solidOf(game).gone).toBe(false);
    expect(solidOf(game, 'next').gone).toBe(true);
    hover(game, 20);
    expect(solidOf(game).gone).toBe(false);
    expect(solidOf(game).top).toBeCloseTo(0.4);
    expect(solidOf(game, 'next').gone).toBe(true);
  });

  it('the first step onto it starts the row: the next comes up the stagger later, and the first keeps the rhythm from then', () => {
    const game = waiting();
    hover(game, 1);
    standOnBack(game);
    const seen = wait(game, 0.8, 'next');
    expect(seen).toEqual([]);
    // The second's stagger is 0.9 s, and it takes 0.5 s to come up.
    expect(wait(game, 0.3, 'next')).toEqual(['back']);
    wait(game, 0.6);
    expect(solidOf(game, 'next').gone).toBe(false);
    // The first stays up for `up` (2.5 s) from the step, then goes under with the hero on it.
    const game2 = waiting();
    hover(game2, 1);
    standOnBack(game2);
    wait(game2, 2.2);
    expect(solidOf(game2).gone).toBe(false);
    wait(game2, 1.5);
    expect(game2.swimming).toBe(true);
  });

  it('a hero back on the bank before the row finds it waiting again, and the others go under smoothly, not all at once', () => {
    const level = yard({ waitFor: 'back' });
    // A bank near the row's first crocodile, inside its wake.
    level.solids.push({ id: 'shore', kind: 'bank', shape: 'box', x: 5, z: -10, halfX: 1, halfZ: 1, top: 0.3, bottom: -40 });
    const game = new Game(level, 'normal', 'Yaarbro');
    hover(game, 1);
    standOnBack(game);
    wait(game, 1.6);
    expect(solidOf(game, 'next').gone).toBe(false);
    Object.assign(game, { x: 5, z: -10, y: 0.3, vx: 0, vy: 0, vz: 0, grounded: true, groundId: 'shore' });
    game.step(IDLE);
    // A moment later the second is still on its way down...
    expect(solidOf(game, 'next').top).toBeGreaterThan(0.4 - FLOAT_LOW + 0.5);
    for (let i = 0; i < 1.5 / STEP; i += 1) {
      Object.assign(game, { x: 5, z: -10, grounded: true, groundId: 'shore' });
      game.step(IDLE);
    }
    // ...and then under, while the first waits again.
    expect(solidOf(game, 'next').gone).toBe(true);
    expect(solidOf(game).gone).toBe(false);
    for (let i = 0; i < 10 / STEP; i += 1) {
      Object.assign(game, { x: 5, z: -10, grounded: true, groundId: 'shore' });
      game.step(IDLE);
    }
    expect(solidOf(game).gone).toBe(false);
  });

  it('floatPhase: a waiting first crocodile rises from when a hero came near, and the step does not make it rise again', () => {
    const m: Float = { ...FLOAT, waitFor: 'back' };
    expect(floatPhase(m, -1, -1).phase).toBe('gone');
    expect(floatPhase(m, -1, 0.2).phase).toBe('rise');
    expect(floatPhase(m, -1, 30)).toMatchObject({ phase: 'rest', under: 0, left: Infinity });
    expect(floatPhase(m, 0, 30)).toMatchObject({ phase: 'rest', under: 0 });
    expect(floatPhase(m, 0.1, 30).left).toBeCloseTo(m.up - 0.1);
    // Next time round it comes up as the others do.
    expect(floatPhase(m, m.period + 0.1, 30).phase).toBe('rise');
  });
});

describe('the lake\'s crossing, as the owner asked on 2026-11-16', () => {
  const stones = (level: Level): Solid[] => level.solids.filter((s) => s.motion?.kind === 'float');
  it('Normal waits for the first step of each row; Easy and Hard do not', () => {
    const first = (difficulty: (typeof DIFFICULTIES)[number]): (string | undefined)[] => [...new Set(stones(buildLake(difficulty)).map((s) => (s.motion as Float).waitFor))];
    expect(first('easy')).toEqual([undefined]);
    expect(first('hard')).toEqual([undefined]);
    const level = buildLake('normal');
    const firsts = first('normal');
    // Two rows, each waiting for its own first crocodile, which is the first on the way across.
    expect(firsts).toHaveLength(2);
    for (const id of firsts) expect((level.solids.find((s) => s.id === id)!.motion as Float).delay).toBe(0);
  });

  it('on Normal the wave is slower and they stay up longer than before (1.1 s apart and 2.9 s up)', () => {
    const n = LAKE_DIFFICULTY.normal;
    expect(n.stoneStagger).toBeGreaterThan(1.1);
    expect(n.stoneUp).toBeGreaterThan(2.9);
    expect(n.stonePeriod!).toBeGreaterThan(n.stoneUp + 1);
  });

  it('the footing is the whole crocodile as drawn, head to tail: the drawing is made to the solid\'s size', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const s of stones(buildLake(difficulty))) {
        expect(stoneLength(s)).toBeCloseTo(4.6);
        // Its tail tip, 2.2 m from its middle along it, is footing.
        expect(touchesFromAbove(s, s.x + 2.2, s.z, MOVE.footRadius)).toBe(true);
        expect(touchesFromAbove(s, s.x - 2.2, s.z, MOVE.footRadius)).toBe(true);
        // About as wide as the drawn body, legs and all (1.5 m).
        expect(s.halfZ * 2).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it('the camera looks straight up the rows, so up on the keys runs along them', () => {
    const level = buildLake('normal');
    expect(cameraFor(level, 'point').facing).toBe(0);
    const row = stones(level);
    // Every crocodile is straight up the channel from the one before, give or take its sideways step.
    for (let i = 1; i < row.length; i += 1) expect(Math.abs(row[i].x - row[i - 1].x)).toBeLessThanOrEqual(1.01);
  });
});

describe('a crocodile stepping stone', () => {
  it('lies under the water, out of sight and not there to stand on, while no hero is near', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    wait(game, 3);
    const back = solidOf(game);
    expect(back.gone).toBe(true);
    expect(back.top).toBeCloseTo(0.4 - FLOAT_LOW);
  });

  it('a hero near the row\'s first crocodile wakes the row: they surface one after another, each with a splash', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    const seen = hover(game, 1.6);
    expect(seen.slice(0, 2)).toEqual(['back:back', 'next:back']);
    expect(solidOf(game).gone).toBe(false);
    expect(solidOf(game).top).toBeCloseTo(0.4);
    // The second came up the stagger later: 0.9 s.
    expect(floatPhase(solidOf(game, 'next').motion as Float, 0.9 + 0.2).phase).toBe('rise');
  });

  it('keeps its rhythm: up, a warning, under (the hero drops into the water, never a fall), and up again a period later', () => {
    const game = upAndOn();
    // Up for 2.5 s from the start of its rise; the warning is the last 0.8 of that.
    expect(wait(game, 1.0, 'back')).toEqual([]);
    expect(game.groundId).toBe('back');
    expect(wait(game, 0.6, 'back')).toEqual(['tell']);
    expect(solidOf(game).piece?.telling).toBe(true);
    expect(wait(game, 1.5, 'back')).toEqual(['fall']);
    expect(solidOf(game).gone).toBe(true);
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
    expect(game.heartsLost).toBe(0);
    // It comes up again 6 s after it last did, whether the hero hops off or not.
    expect(wait(game, 3, 'back')).toEqual(['back']);
  });

  it('dips a little under a hero, and bobs back up when they leave', () => {
    const game = upAndOn({ period: Infinity });
    wait(game, 0.5);
    expect(solidOf(game).top).toBeCloseTo(0.4 - 0.12, 2);
    Object.assign(game, { x: 0, y: 3, z: -8, vy: 0, grounded: false, groundId: null });
    for (let i = 0; i < 0.5 / STEP; i += 1) {
      Object.assign(game, { y: 3, vy: 0 });
      game.step(IDLE);
    }
    expect(solidOf(game).top).toBeCloseTo(0.4, 2);
  });

  it('cannot be climbed onto from the water', () => {
    const game = upAndOn({ period: Infinity });
    const back = solidOf(game);
    Object.assign(game, { x: back.x, z: back.z + back.halfZ + 0.6, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'pool' });
    for (let i = 0; i < 2 / STEP; i += 1) game.step({ ...IDLE, moveZ: -1, jump: i % 20 < 10 });
    expect(game.swimming).toBe(true);
    expect(game.climbing).toBe(0);
  });

  it('with no rhythm (Easy) the wave runs once and they stay up, with a hero on them or not', () => {
    const game = upAndOn({ period: Infinity });
    expect(wait(game, 30)).toEqual(['back']);
    expect(game.groundId).toBe('back');
    expect(solidOf(game, 'next').gone).toBe(false);
  });

  it('with snap (Hard), a hero who stays on one that long is snapped at: a heart, and thrown off', () => {
    const game = upAndOn({ snap: 1, period: Infinity });
    const seen = wait(game, 1.1, 'back');
    expect(seen).toEqual(['snap']);
    expect(game.heartsLost).toBe(1);
    expect(game.groundId).toBeNull();
  });

  it('with snap, a hero who hops off in time is not snapped at', () => {
    const game = upAndOn({ snap: 1, period: Infinity });
    wait(game, 0.6);
    hover(game, 1.5, -8);
    expect(game.heartsLost).toBe(0);
  });

  it('a hero sent back to a safe bank finds the row asleep under the water again', () => {
    const game = upAndOn();
    wait(game, 0.5);
    Object.assign(game, { x: 30, z: 30, y: -20, swimming: false, grounded: false, groundId: null });
    for (let i = 0; i < 1 / STEP && game.falls === 0; i += 1) game.step(IDLE);
    expect(game.falls).toBe(1);
    expect(solidOf(game).gone).toBe(true);
    expect(solidOf(game).piece?.since).toBe(-1);
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

  it('on Easy they stay up, so timing does not matter; on Normal and Hard they keep a rhythm; on Hard it is quicker and they snap (the owner\'s rules)', () => {
    const [e, n, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d]);
    expect(e.stonePeriod).toBeUndefined();
    expect(stones(buildLake('easy')).every((s) => (s.motion as Float).period === Infinity)).toBe(true);
    expect(n.stonePeriod!).toBeGreaterThan(h.stonePeriod!);
    expect(n.stoneUp).toBeGreaterThan(h.stoneUp);
    expect([e.stoneSnap, n.stoneSnap]).toEqual([undefined, undefined]);
    expect(h.stoneSnap!).toBeGreaterThan(0);
    // Longer, with more crocodiles, the harder it is.
    expect(e.crossing).toBeLessThan(n.crossing);
    expect(n.crossing).toBeLessThan(h.crossing);
    const counts = DIFFICULTIES.map((d) => stones(buildLake(d)).length);
    expect(counts[0]).toBeGreaterThanOrEqual(10);
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    for (const k of [n, h]) {
      // The wave is never faster than a hero hopping from back to back (about 0.9 s a hop), so a hero can keep up with it...
      expect(k.stoneStagger).toBeGreaterThanOrEqual(0.9);
      // ...and while one is up the next comes up, with time left to hop across.
      expect(k.stoneUp - k.stoneStagger - 0.45).toBeGreaterThan(0.6);
    }
    // Hard's snap leaves time to wait for the next crocodile to finish coming up, and comes before
    // the one under a hero who landed in step with the wave would go under: standing still is snapped at.
    expect(h.stoneSnap!).toBeGreaterThan(0.6);
    expect(h.stoneSnap!).toBeLessThan(h.stoneUp - 1.15);
  });

  it('each row surfaces as a wave up the channel: a crocodile further along comes up later', () => {
    for (const difficulty of DIFFICULTIES) {
      const row = stones(buildLake(difficulty));
      for (let i = 1; i < row.length; i += 1) {
        const [a, b] = [row[i - 1].motion as Float, row[i].motion as Float];
        if (a.from.z === b.from.z) expect(b.delay, `${difficulty} ${row[i].id}`).toBeGreaterThan(a.delay);
        else expect(b.delay).toBe(0);
      }
    }
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
      for (let i = 0; i < 8 / STEP; i += 1) game.step(IDLE);
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
    for (let i = 0; i < 8 / STEP && !game.swimming; i += 1) game.step(IDLE);
    expect(game.swimming).toBe(true);
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) game.step(bot.input(game));
    expect(game.complete).toBe(true);
    expect(game.falls).toBe(0);
  });
});
