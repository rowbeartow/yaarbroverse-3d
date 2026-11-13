// Runs over every level in the level list (src/levels/index.ts), so a new
// level is checked the moment it is listed: it is well formed, and the bot
// finishes it on every difficulty as each hero.

import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../src/audio/sounds';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, MOVE, STEP } from '../src/game/hero';
import { surfaceBelow } from '../src/game/level';
import { LEVELS, findLevel, levelFromAddress, listedLevels } from '../src/levels';
import { Bot, playWithBot } from './helpers/bot';

describe('the level list', () => {
  it('gives every level its own id, in lower case and dashes', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('shows players the Bouncing Grove and never the sandbox', () => {
    expect(listedLevels().map((level) => level.id)).toEqual(['bouncing-grove']);
    expect(findLevel('sandbox')?.devOnly).toBe(true);
  });

  it('opens a level named on the address, and nothing for a name it does not know', () => {
    expect(levelFromAddress('?level=sandbox')?.id).toBe('sandbox');
    expect(levelFromAddress('?fps&level=bouncing-grove')?.id).toBe('bouncing-grove');
    expect(levelFromAddress('?level=nowhere')).toBeNull();
    expect(levelFromAddress('')).toBeNull();
  });
});

describe.each(LEVELS.map((level) => [level.id, level] as const))('the level %s', (_id, entry) => {
  it('has a name, a line for the start screen, a line per difficulty and music from the sound list', () => {
    expect(entry.name.trim()).not.toBe('');
    expect(entry.lead.trim()).not.toBe('');
    for (const difficulty of DIFFICULTIES) expect(entry.blurbs[difficulty].trim()).not.toBe('');
    expect(SOUNDS[entry.music]).toMatchObject({ mix: 'music', loop: true });
  });

  describe.each(DIFFICULTIES)('on %s', (difficulty) => {
    it('is well formed: named, with a route over its own solids, starting on a safe bank', () => {
      const level = entry.build(difficulty);
      expect(level.name).toBe(entry.name);
      const ids = level.solids.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(level.route.length).toBeGreaterThan(0);
      for (const id of level.route) expect(ids).toContain(id);
      for (const section of level.sections ?? []) for (const id of section.solids) expect(ids).toContain(id);
      for (const id of Object.keys(level.hints ?? {})) expect(ids).toContain(id);
      for (const spot of level.enemies ?? []) expect(spot.id.trim()).not.toBe('');
      const under = surfaceBelow(level, level.spawn.x, level.spawn.z, level.spawn.y, MOVE.footRadius);
      expect(under?.safe).toBe(true);
      expect(level.hearts).toBeGreaterThan(0);
      expect(level.fallY).toBeLessThan(Math.min(...level.solids.map((s) => s.top)));
    });

    it.each(HEROES)('the bot reaches the golden leaf as %s, without a fall or a lost heart, on walk and jump alone', (hero) => {
      const game = playWithBot(new Game(entry.build(difficulty), difficulty, hero), 300);
      expect(game.summary()).toMatchObject({ level: entry.name, difficulty, hero, complete: true, falls: 0, heartsLost: 0 });
      expect(game.movesUsed).toBe(0);
    });

    it('the bot crosses every part of the route in order', () => {
      const level = entry.build(difficulty);
      const game = new Game(level, difficulty, 'Yaarbro');
      const bot = new Bot(level);
      const touched: string[] = [];
      const touch = (id: string | null): void => {
        if (id && !touched.includes(id)) touched.push(id);
      };
      touch(game.groundId);
      for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
        game.step(bot.input(game));
        touch(game.groundId);
        for (const event of game.events) if (event.type === 'bounce') touch(event.solidId);
      }
      expect(game.complete).toBe(true);
      expect(touched).toEqual(level.route);
    });

    it('is not finished by standing still', () => {
      const game = new Game(entry.build(difficulty), difficulty, 'Yaarbro');
      for (let i = 0; i < 10 / STEP; i += 1) game.step(IDLE);
      expect(game.complete).toBe(false);
      expect(game.falls).toBe(0);
    });
  });
});
