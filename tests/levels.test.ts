// Runs over every level in the level list (src/levels/index.ts), so a new
// level is checked the moment it is listed: it is well formed, and the bot
// finishes it on every difficulty as each hero.

import { describe, expect, it } from 'vitest';
import { GameSounds } from '../src/audio/game-sounds';
import { Sound, type Speaker } from '../src/audio/mix';
import { SOUNDS, soundAt, type SoundName } from '../src/audio/sounds';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, MOVE, STEP } from '../src/game/hero';
import { surfaceBelow } from '../src/game/level';
import { existsSync, statSync } from 'node:fs';
import { LEVELS, findLevel, levelFromAddress, listedLevels, shownLevels } from '../src/levels';
import { Bot } from './helpers/bot';

describe('the level list', () => {
  it('gives every level its own id, in lower case and dashes', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('shows players the Bouncing Grove, then Cocolalla Lake, and never the sandbox', () => {
    expect(listedLevels().map((level) => level.id)).toEqual(['bouncing-grove', 'cocolalla']);
    expect(findLevel('sandbox')?.devOnly).toBe(true);
  });

  it('opens a level named on the address, and nothing for a name it does not know', () => {
    expect(levelFromAddress('?level=sandbox')?.id).toBe('sandbox');
    expect(levelFromAddress('?fps&level=bouncing-grove')?.id).toBe('bouncing-grove');
    expect(levelFromAddress('?level=nowhere')).toBeNull();
    expect(levelFromAddress('')).toBeNull();
  });
});

describe('the level picker’s cards', () => {
  it('are the levels players are shown, plus a development level only when the address names it', () => {
    const players = ['bouncing-grove', 'cocolalla'];
    expect(shownLevels('').map((level) => level.id)).toEqual(players);
    expect(shownLevels('?fps').map((level) => level.id)).toEqual(players);
    expect(shownLevels('?level=bouncing-grove').map((level) => level.id)).toEqual(players);
    expect(shownLevels('?level=cocolalla').map((level) => level.id)).toEqual(players);
    expect(shownLevels('?level=sandbox').map((level) => level.id)).toEqual([...players, 'sandbox']);
    expect(shownLevels('?level=nowhere').map((level) => level.id)).toEqual(players);
  });

  it.each(listedLevels().map((level) => [level.id, level] as const))('%s has a small picture for its card', (id, level) => {
    expect(level.card).toBe(`cards/${id}.jpg`);
    expect(existsSync(`public/${level.card}`)).toBe(true);
    // A card is small on screen: keep its picture small in the download.
    expect(statSync(`public/${level.card}`).size).toBeLessThan(60_000);
  });
});

describe.each(LEVELS.map((level) => [level.id, level] as const))('the level %s', (_id, entry) => {
  it('has a name, a line for the start screen, a line per difficulty and music from the sound list', () => {
    expect(entry.name.trim()).not.toBe('');
    expect(entry.lead.trim()).not.toBe('');
    for (const difficulty of DIFFICULTIES) expect(entry.blurbs[difficulty].trim()).not.toBe('');
    expect(SOUNDS[entry.music]).toMatchObject({ mix: 'music', loop: true });
  });

  it('has every sound its pieces make among the shared sounds or its own, so each is fetched when the level is picked', () => {
    // What each kind of piece plays (src/audio/game-sounds.ts).
    const needs = new Set<SoundName>([entry.music]);
    if (entry.bossMusic) needs.add(entry.bossMusic);
    for (const difficulty of DIFFICULTIES) {
      const level = entry.build(difficulty);
      const kinds = new Set((level.enemies ?? []).map((spot) => spot.kind));
      if (level.boss) for (const name of ['bossBeaten', 'marmotTell', 'marmotThrow'] as const) needs.add(name);
      if (kinds.has('marmot')) for (const name of ['marmotTell', 'marmotThrow'] as const) needs.add(name);
      if (kinds.has('crocodile')) for (const name of ['crocTell', 'crocBite', 'crocSplash', 'crocHit'] as const) needs.add(name);
      if (level.water?.length) for (const name of ['waterIn', 'stroke', 'surfacing', 'lapping'] as const) needs.add(name);
      for (const solid of level.solids) {
        if (solid.motion?.kind === 'tip') needs.add('creak');
        if (solid.motion?.kind === 'crumble') for (const name of ['mossRustle', 'mossFall'] as const) needs.add(name);
        if (solid.motion?.kind === 'sway') needs.add('gust');
      }
    }
    for (const name of needs) expect(soundAt(name, entry.id), `${name} in ${entry.id}`).toBe(true);
  });

  describe.each(DIFFICULTIES)('on %s', (difficulty) => {
    it('is well formed: named, with a route over its own solids, starting on a safe bank', () => {
      const level = entry.build(difficulty);
      expect(level.name).toBe(entry.name);
      const ids = level.solids.map((s) => s.id);
      const pools = (level.water ?? []).map((w) => w.id);
      expect(new Set([...ids, ...pools]).size).toBe(ids.length + pools.length);
      expect(level.route.length).toBeGreaterThan(0);
      for (const id of level.route) expect([...ids, ...pools]).toContain(id);
      // Every pool is deep, above the height a fall counts from, and crossed on the way.
      for (const water of level.water ?? []) {
        expect(water.surface - water.floor).toBeGreaterThan(2.5);
        expect(water.floor).toBeGreaterThan(level.fallY);
        expect(level.route).toContain(water.id);
      }
      for (const section of level.sections ?? []) for (const id of section.solids) expect(ids).toContain(id);
      for (const id of Object.keys(level.hints ?? {})) expect(ids).toContain(id);
      for (const spot of level.enemies ?? []) expect(spot.id.trim()).not.toBe('');
      const under = surfaceBelow(level, level.spawn.x, level.spawn.z, level.spawn.y, MOVE.footRadius);
      expect(under?.safe).toBe(true);
      expect(level.hearts).toBeGreaterThan(0);
      expect(level.fallY).toBeLessThan(Math.min(...level.solids.map((s) => s.top)));
    });

    it.each(HEROES)('the bot reaches the golden leaf as %s on walk and jump alone: no fall, no heart lost on the way, and any boss beaten in its first fight', (hero) => {
      const game = new Game(entry.build(difficulty), difficulty, hero);
      const bot = new Bot(game.level);
      let lostOnTheWay = -1;
      for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
        game.step(bot.input(game));
        if (lostOnTheWay < 0 && game.events.some((event) => event.type === 'boss' && event.what === 'begin')) lostOnTheWay = game.heartsLost;
      }
      expect(game.summary()).toMatchObject({ level: entry.name, difficulty, hero, complete: true, falls: 0 });
      expect(game.movesUsed).toBe(0);
      if (game.boss) {
        // A level with a boss: nothing lost before the fight, the boss beaten first time, and never out of hearts.
        expect(lostOnTheWay).toBe(0);
        expect([game.boss.phase, game.boss.fights]).toEqual(['defeated', 1]);
        expect(game.heartsLost).toBeLessThan(game.level.hearts);
      } else expect(game.heartsLost).toBe(0);
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
      // Every sound the run asks for, to check each is one this level has fetched.
      const heard = new Set<SoundName>();
      const speaker: Speaker = { wake: () => undefined, play: (name) => void heard.add(name), setLoop: (name) => void heard.add(name), setMusic: () => undefined, playTune: (name) => void (name && heard.add(name)), setMuted: () => undefined };
      const sound = new Sound(speaker, null);
      sound.unlock();
      const sounds = new GameSounds(sound);
      for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
        game.step(bot.input(game));
        sounds.step(game);
        touch(game.groundId);
        touch(game.waterId);
        for (const event of game.events) if (event.type === 'bounce') touch(event.solidId);
      }
      expect(game.complete).toBe(true);
      expect(touched).toEqual(level.route);
      expect(heard.size).toBeGreaterThan(3);
      for (const name of heard) expect(soundAt(name, entry.id), `${name} in ${entry.id}`).toBe(true);
    });

    it('is not finished by standing still', () => {
      const game = new Game(entry.build(difficulty), difficulty, 'Yaarbro');
      for (let i = 0; i < 10 / STEP; i += 1) game.step(IDLE);
      expect(game.complete).toBe(false);
      expect(game.falls).toBe(0);
    });
  });
});
