// Plays the real level start to finish on each difficulty, with a bot that
// follows the same rules a player does. If a change to the numbers or the rules
// makes a difficulty impossible, these fail.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, STEP } from '../src/game/hero';
import { GROVE_DIFFICULTY } from '../src/levels/bouncing-grove/difficulty';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { Bot, playWithBot } from './helpers/bot';

describe.each(DIFFICULTIES)('a full run of the Bouncing Grove on %s', (difficulty) => {
  it.each(HEROES)('beats the marmot chief and reaches the golden leaf as %s, without a fall', (hero) => {
    const game = playWithBot(new Game(buildGrove(difficulty), difficulty, hero), 300);
    const summary = game.summary();
    expect(summary.complete).toBe(true);
    expect(summary.falls).toBe(0);
    // With walk and jump alone: the level never needs a roll or a pounce.
    expect(game.movesUsed).toBe(0);
    // The chief is beaten in its first fight: the bot is never sent back, so it never runs out of hearts.
    expect(game.boss?.phase).toBe('defeated');
    expect(game.boss?.fights).toBe(1);
    expect(summary.heartsLost).toBeLessThan(game.level.hearts);
    expect(summary).toMatchObject({ level: 'The Bouncing Grove', difficulty, hero });
    expect(summary.seconds).toBeGreaterThan(40);
    expect(summary.seconds).toBeLessThan(150);
  });

  it('crosses every part of the route in order', () => {
    const level = buildGrove(difficulty);
    const game = new Game(level, difficulty, 'Yaarbro');
    const bot = new Bot(level);
    const touched: string[] = [];
    const touch = (id: string | null): void => {
      if (id && touched[touched.length - 1] !== id) touched.push(id);
    };
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
      game.step(bot.input(game));
      touch(game.groundId);
      for (const event of game.events) if (event.type === 'bounce') touch(event.solidId);
    }
    expect(game.complete).toBe(true);
    // Every solid appears, in route order. Repeats (a second bounce on the
    // same mushroom) are fine.
    expect(touched.filter((id, i) => touched.indexOf(id) === i)).toEqual(level.route);
  });

  it('does not finish by standing still', () => {
    const game = new Game(buildGrove(difficulty), difficulty, 'Yaarbro');
    for (let i = 0; i < 10 / STEP; i += 1) game.step(IDLE);
    expect(game.complete).toBe(false);
    expect(game.falls).toBe(0);
  });
});

describe('falling in the Bouncing Grove', () => {
  /** Follows the bot until standing on the given solid, then walks off its left side. */
  const fallFrom = (difficulty: (typeof DIFFICULTIES)[number], solidId: string): Game => {
    const level = buildGrove(difficulty);
    const game = new Game(level, difficulty, 'Caputo');
    const bot = new Bot(level);
    for (let i = 0; i < 60 / STEP && game.groundId !== solidId; i += 1) game.step(bot.input(game));
    expect(game.groundId).toBe(solidId);
    for (let i = 0; i < 10 / STEP && game.falls === 0; i += 1) game.step({ ...IDLE, moveX: -1 });
    expect(game.falls).toBe(1);
    return game;
  };

  it('walking off the first bank returns the hero to it', () => {
    const game = fallFrom('normal', 'bank-start');
    expect(game.groundId).toBe('bank-start');
    expect([game.x, game.y, game.z]).toEqual([0, 0, 0]);
  });

  it('on Easy and Normal a fall from the stumps returns to the bank before them', () => {
    expect(fallFrom('easy', 'stump-2').groundId).toBe('bank-1');
    expect(fallFrom('normal', 'stump-2').groundId).toBe('bank-1');
  });

  it('on Hard a fall from the stumps returns all the way to the first bank', () => {
    expect(GROVE_DIFFICULTY.hard.checkpoints).not.toContain(1);
    expect(fallFrom('hard', 'stump-2').groundId).toBe('bank-start');
  });

  it('a fall from the high log returns to the bank before it on Easy and Normal, and to the clearing on Hard', () => {
    expect(fallFrom('easy', 'high-log').groundId).toBe('bank-3');
    expect(fallFrom('normal', 'high-log').groundId).toBe('bank-3');
    expect(fallFrom('hard', 'high-log').groundId).toBe('bank-2');
  });

  it('a fall from the high boughs returns to the ledge before them', () => {
    for (const difficulty of DIFFICULTIES) expect(fallFrom(difficulty, 'bough-3').groundId).toBe('bank-4');
  });

  it('a fall on the last climb returns to the bank below it on Easy and Normal, and to the ledge on Hard', () => {
    expect(fallFrom('easy', 'moss-1').groundId).toBe('bank-5');
    expect(fallFrom('normal', 'wind-perch').groundId).toBe('bank-5');
    expect(fallFrom('hard', 'wind-perch').groundId).toBe('bank-4');
  });

  it('a fall in the ravine returns to the clearing', () => {
    for (const difficulty of DIFFICULTIES) expect(fallFrom(difficulty, 'ravine-log-2').groundId).toBe('bank-2');
  });

  it('a hero can finish after falling', () => {
    const game = fallFrom('normal', 'stump-2');
    playWithBot(game, 300);
    expect(game.complete).toBe(true);
    expect(game.summary().falls).toBe(1);
  });
});
