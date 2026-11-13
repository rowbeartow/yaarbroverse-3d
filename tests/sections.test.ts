// The grove's sections and checkpoints: each section ends on a bank, a fall
// costs no more than the rules for each difficulty allow, and a perfect run
// takes about as long as it should. Times come from the bot, which plays by
// the same rules a player does.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { Bot } from './helpers/bot';

const byId = (level: Level, id: string): Solid => {
  const found = level.solids.find((s) => s.id === id);
  if (!found) throw new Error(`No solid called ${id}`);
  return found;
};

/** A clean run by the bot: the time each solid was first stood or bounced on, and the finish time. */
const cleanRun = (difficulty: Difficulty): { level: Level; reached: Map<string, number>; seconds: number } => {
  const level = buildGrove(difficulty);
  const game = new Game(level, difficulty, 'Yaarbro');
  const bot = new Bot(level);
  const reached = new Map<string, number>([[level.route[0], 0]]);
  for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
    game.step(bot.input(game));
    const touched = [game.groundId, ...game.events.map((e) => (e.type === 'bounce' ? e.solidId : null))];
    for (const id of touched) if (id && !reached.has(id)) reached.set(id, game.seconds);
  }
  expect(game.complete).toBe(true);
  expect(game.falls).toBe(0);
  return { level, reached, seconds: game.seconds };
};

/** How long a perfect run of the whole grove should take on each difficulty, in seconds. */
const RUN_TIME: Record<Difficulty, [number, number]> = {
  easy: [35, 55],
  normal: [52, 68],
  hard: [55, 80],
};

/** How long the bot's fight with the marmot chief should take, from stepping onto its bank to the leaf. */
const CHIEF_TIME: Record<Difficulty, [number, number]> = {
  easy: [8, 25],
  normal: [20, 50],
  hard: [30, 70],
};

describe.each(DIFFICULTIES)('the sections of the grove on %s', (difficulty) => {
  const { level, reached, seconds } = cleanRun(difficulty);
  const sections = level.sections ?? [];

  it('together hold every solid once, in route order', () => {
    expect(sections.flatMap((s) => s.solids)).toEqual(level.route);
    // Every section but the last is several pieces; the last is the bough with the leaf, past the chief.
    for (const section of sections.slice(0, -1)) expect(section.solids.length).toBeGreaterThan(1);
    expect(sections[sections.length - 1].solids).toEqual(['bough']);
  });

  it('each end on a bank, and the last on the bough with the leaf', () => {
    sections.forEach((section, i) => {
      const last = byId(level, section.solids[section.solids.length - 1]);
      expect(last.kind, section.name).toBe(i === sections.length - 1 ? 'bough' : 'bank');
    });
  });

  // `GROVE_TIMES=1 npm test` prints when a perfect run reaches the end of each section.
  if (process.env.GROVE_TIMES) {
    const ends = sections.map((s) => `${s.name} ${(reached.get(s.solids[s.solids.length - 1]) ?? seconds).toFixed(1)}`);
    console.log(`${difficulty}: ${ends.join(', ')}; leaf ${seconds.toFixed(1)} s`);
  }

  it('a perfect run takes about as long as planned: to the chief’s bank, and then the fight', () => {
    const toChief = reached.get('bank-6') ?? Infinity;
    expect(toChief).toBeGreaterThan(RUN_TIME[difficulty][0]);
    expect(toChief).toBeLessThan(RUN_TIME[difficulty][1]);
    expect(seconds - toChief).toBeGreaterThan(CHIEF_TIME[difficulty][0]);
    expect(seconds - toChief).toBeLessThan(CHIEF_TIME[difficulty][1]);
  });

  it('a fall never costs more than about 30 seconds of a perfect run', () => {
    // The worst place to fall after each safe bank is just before the next
    // safe bank, or just before the leaf.
    // The chief's bank is the last safe one. What comes after it is the fight, which a hero sent back starts over (the regen rule).
    const safeTimes = level.route.filter((id) => byId(level, id).safe).map((id) => reached.get(id) ?? Infinity);
    expect(byId(level, 'bank-6').safe).toBe(true);
    for (let i = 1; i < safeTimes.length; i += 1) expect(safeTimes[i] - safeTimes[i - 1]).toBeLessThan(32);
  });

  it('a fall in any section returns the hero to the last safe bank before it', () => {
    let lastSafe = level.route[0];
    for (const section of sections) {
      // Fall from the first thing in the section that is not a bank.
      const from = section.solids.find((id) => byId(level, id).kind !== 'bank' && !byId(level, id).bounce);
      if (from) {
        const game = new Game(level, difficulty, 'Caputo');
        const bot = new Bot(level);
        for (let i = 0; i < 300 / STEP && game.groundId !== from; i += 1) game.step(bot.input(game));
        expect(game.groundId).toBe(from);
        // Walk off the side: left is open air everywhere on the route.
        for (let i = 0; i < 10 / STEP && game.falls === 0; i += 1) game.step({ ...IDLE, moveX: -1 });
        expect(game.falls).toBe(1);
        expect(game.groundId, `${section.name} on ${difficulty}`).toBe(lastSafe);
      }
      for (const id of section.solids) if (byId(level, id).safe) lastSafe = id;
    }
  });
});

describe('the seven sections', () => {
  it('are the ones in the route plan, on every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      expect((buildGrove(difficulty).sections ?? []).map((s) => s.name)).toEqual([
        'The Broken Logs',
        'The Stump Steps',
        'The Ravine',
        'The Mushroom Springs',
        'The High Boughs',
        'The Climb',
        'The Marmot Chief',
      ]);
    }
  });

  it('get harder along the route on Normal: no section before the chief is shorter than 5 seconds or longer than 15', () => {
    const { level, reached } = cleanRun('normal');
    let last = 0;
    for (const section of (level.sections ?? []).slice(0, -1)) {
      const end = reached.get(section.solids[section.solids.length - 1]) ?? 0;
      expect(end - last, section.name).toBeGreaterThan(5);
      expect(end - last, section.name).toBeLessThan(15);
      last = end;
    }
  });
});

describe('checkpoints by difficulty', () => {
  it('on Easy and Normal every section ends on a safe bank', () => {
    for (const difficulty of ['easy', 'normal'] as const) {
      const level = buildGrove(difficulty);
      const banks = level.solids.filter((s) => s.kind === 'bank');
      expect(banks.every((s) => s.safe)).toBe(true);
    }
  });

  it('on Hard some banks are bare stone', () => {
    const banks = buildGrove('hard').solids.filter((s) => s.kind === 'bank');
    expect(banks.some((s) => !s.safe)).toBe(true);
    expect(banks[0].safe).toBe(true);
  });
});
