// Players and saved progress: saving and loading, damaged saved data, separate
// players, and what counts as a best. The names here are made up.

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { LEVELS } from '../src/levels';
import {
  COLOURS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  PLAYERS_KEY,
  Players,
  bestFor,
  bestTime,
  cleanName,
  endBests,
  hasFinished,
  progressOn,
  type Run,
} from '../src/save/players';
import { playWithBot } from './helpers/bot';
import { FakeStorage } from './helpers/storage';

const run = (over: Partial<Run> = {}): Run => ({
  levelId: 'bouncing-grove',
  hero: 'Yaarbro',
  difficulty: 'normal',
  seconds: 80,
  falls: 3,
  complete: true,
  ...over,
});

describe('adding players', () => {
  it('starts with nobody, and keeps a typed name and a colour', () => {
    const players = new Players(new FakeStorage());
    expect(players.list()).toEqual([]);
    expect(players.last).toBeNull();
    const pip = players.add('  Pip  ', 'sky');
    expect(pip).toMatchObject({ name: 'Pip', colour: 'sky', hero: 'Yaarbro', difficulty: 'normal', bests: {} });
    expect(players.list()).toHaveLength(1);
  });

  it('takes four players and no more', () => {
    const players = new Players(new FakeStorage());
    for (let i = 0; i < MAX_PLAYERS; i += 1) expect(players.add(`Player ${i + 1}`, COLOURS[i].id)).not.toBeNull();
    expect(players.full).toBe(true);
    expect(players.add('Fifth', 'moss')).toBeNull();
    expect(players.list()).toHaveLength(4);
    expect(new Set(players.list().map((player) => player.id)).size).toBe(4);
  });

  it('refuses an empty name and a colour it does not know', () => {
    const players = new Players(new FakeStorage());
    expect(players.add('   ', 'moss')).toBeNull();
    expect(players.add('Pip', 'beige' as never)).toBeNull();
    expect(players.list()).toEqual([]);
  });

  it('tidies names: spacing, control characters, and twelve characters at most', () => {
    expect(cleanName('  Moss \n  the\tBrave ')).toBe('Moss the Bra');
    expect(cleanName('a'.repeat(40))).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName(String.fromCharCode(0, 0x200b, 0x2028))).toBe('');
    expect(cleanName(42)).toBe('');
    // Whole characters, never half of one.
    expect(Array.from(cleanName('🦊'.repeat(20)))).toHaveLength(MAX_NAME_LENGTH);
  });

  it('gives a first player the hero and difficulty this device chose before there were players', () => {
    const storage = new FakeStorage();
    storage.items.set('yaarbroverse-3d:choice', JSON.stringify({ hero: 'Caputo', difficulty: 'hard' }));
    const players = new Players(storage);
    expect(players.add('Pip', 'moss')).toMatchObject({ hero: 'Caputo', difficulty: 'hard' });
    expect(players.add('Moss', 'sky')).toMatchObject({ hero: 'Yaarbro', difficulty: 'normal' });
  });
});

describe('saving and loading', () => {
  it('a new visit finds the same players, choices, bests and who played last', () => {
    const storage = new FakeStorage();
    const first = new Players(storage);
    const pip = first.add('Pip', 'berry')!;
    const moss = first.add('Moss', 'plum')!;
    first.setChoice(pip.id, 'Caputo', 'easy');
    first.finish(pip.id, run({ hero: 'Caputo', difficulty: 'easy', seconds: 61.25, falls: 2 }));
    first.choose(moss.id);

    const second = new Players(storage);
    expect(second.list()).toEqual(first.list());
    expect(second.last?.id).toBe(moss.id);
    const again = second.get(pip.id)!;
    expect(again).toMatchObject({ name: 'Pip', colour: 'berry', hero: 'Caputo', difficulty: 'easy' });
    expect(bestFor(again, 'bouncing-grove', 'Caputo', 'easy')).toEqual({ seconds: 61.25, falls: 2 });
  });

  it('keeps everything under one key, and nothing but that key', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    players.add('Pip', 'moss');
    expect([...storage.items.keys()]).toEqual([PLAYERS_KEY]);
  });

  it('works with no storage at all, for as long as the page is open', () => {
    const players = new Players(null);
    const pip = players.add('Pip', 'moss')!;
    expect(players.finish(pip.id, run()).counted).toBe(true);
    expect(bestTime(players.get(pip.id)!, 'bouncing-grove', 'normal')).toBe(80);
  });

  it('carries on when storage refuses to be read or written', () => {
    const storage = new FakeStorage();
    storage.broken = 'both';
    const players = new Players(storage);
    expect(players.list()).toEqual([]);
    const pip = players.add('Pip', 'moss')!;
    expect(() => players.choose(pip.id)).not.toThrow();
    expect(() => players.setChoice(pip.id, 'Caputo', 'hard')).not.toThrow();
    expect(players.finish(pip.id, run()).bestTime).toBe(true);
    expect(() => players.resetProgress(pip.id)).not.toThrow();
    expect(() => players.remove(pip.id)).not.toThrow();
  });
});

describe('damaged saved data', () => {
  const load = (text: string): Players => {
    const storage = new FakeStorage();
    storage.items.set(PLAYERS_KEY, text);
    return new Players(storage);
  };

  it.each([
    ['text that is not saved data', 'not json {'],
    ['an empty string', ''],
    ['null', 'null'],
    ['a number', '7'],
    ['a list', '[1, 2]'],
    ['no players list', '{"version":1}'],
    ['players that is not a list', '{"players":"Pip"}'],
  ])('starts fresh from %s', (_what, text) => {
    const players = load(text);
    expect(players.list()).toEqual([]);
    // And goes on working.
    expect(players.add('Pip', 'moss')).not.toBeNull();
  });

  it('keeps the sound players and drops the damaged ones', () => {
    const players = load(
      JSON.stringify({
        players: [
          { id: 'p-good', name: 'Pip', colour: 'sky', hero: 'Caputo', difficulty: 'hard', bests: {} },
          null,
          'Moss',
          { id: 'p-noname', name: '   ', colour: 'sky' },
          { name: 'No id', colour: 'sky' },
          { id: 'NOT AN ID!', name: 'Bad id' },
          { id: 'p-good', name: 'Twin' },
          { id: 'p-odd', name: 'Odd', colour: 'beige', hero: 'Nobody', difficulty: 'impossible', bests: 'lots' },
        ],
        last: 'p-gone',
      }),
    );
    expect(players.list()).toEqual([
      { id: 'p-good', name: 'Pip', colour: 'sky', hero: 'Caputo', difficulty: 'hard', bests: {} },
      { id: 'p-odd', name: 'Odd', colour: 'moss', hero: 'Yaarbro', difficulty: 'normal', bests: {} },
    ]);
    expect(players.last).toBeNull();
  });

  it('keeps no more than four players, however many were saved', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `p-${i}`, name: `Player ${i}` }));
    expect(load(JSON.stringify({ players: many })).list()).toHaveLength(MAX_PLAYERS);
  });

  it('keeps the sound bests and drops the damaged ones', () => {
    const players = load(
      JSON.stringify({
        players: [
          {
            id: 'p-1',
            name: 'Pip',
            bests: {
              'bouncing-grove': {
                Yaarbro: { normal: { seconds: 70.5, falls: 1.9 }, hard: { seconds: -4, falls: 0 }, easy: { seconds: 'fast', falls: 0 } },
                Caputo: { easy: { seconds: 50 }, normal: null, silly: { seconds: 1, falls: 0 } },
                Nobody: { easy: { seconds: 50, falls: 0 } },
              },
              'BAD LEVEL': { Yaarbro: { easy: { seconds: 50, falls: 0 } } },
              sandbox: 'done',
            },
          },
        ],
      }),
    );
    expect(players.list()[0].bests).toEqual({ 'bouncing-grove': { Yaarbro: { normal: { seconds: 70.5, falls: 1 } } } });
  });

  it('an over-long saved name is cut to twelve characters', () => {
    const players = load(JSON.stringify({ players: [{ id: 'p-1', name: 'x'.repeat(500) }] }));
    expect(players.list()[0].name).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('separate players', () => {
  it('one player’s runs, choices and reset never touch another’s', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'moss')!;
    const moss = players.add('Moss', 'sky')!;
    players.finish(pip.id, run({ seconds: 90 }));
    players.finish(moss.id, run({ seconds: 70, difficulty: 'hard' }));
    players.setChoice(pip.id, 'Caputo', 'easy');

    expect(hasFinished(players.get(pip.id)!, 'bouncing-grove', 'normal')).toBe(true);
    expect(hasFinished(players.get(pip.id)!, 'bouncing-grove', 'hard')).toBe(false);
    expect(hasFinished(players.get(moss.id)!, 'bouncing-grove', 'normal')).toBe(false);
    expect(players.get(moss.id)).toMatchObject({ hero: 'Yaarbro', difficulty: 'normal' });

    expect(players.resetProgress(pip.id)).toBe(true);
    expect(players.get(pip.id)).toMatchObject({ name: 'Pip', colour: 'moss', hero: 'Caputo', difficulty: 'easy', bests: {} });
    expect(bestTime(players.get(moss.id)!, 'bouncing-grove', 'hard')).toBe(70);
  });

  it('removing a player takes their progress and leaves the others', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'moss')!;
    const moss = players.add('Moss', 'sky')!;
    players.choose(pip.id);
    expect(players.remove(pip.id)).toBe(true);
    expect(players.remove(pip.id)).toBe(false);
    expect(players.last).toBeNull();
    expect(new Players(storage).list().map((player) => player.id)).toEqual([moss.id]);
    // There is room for a new player again.
    expect(players.full).toBe(false);
  });

  it('reset and remove do nothing for a player who is not there', () => {
    const players = new Players(new FakeStorage());
    expect(players.resetProgress('p-nobody')).toBe(false);
    expect(players.remove('p-nobody')).toBe(false);
    expect(players.choose('p-nobody')).toBeNull();
  });
});

describe('what counts as a best', () => {
  const fresh = (): { players: Players; id: string; storage: FakeStorage } => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    return { players, id: players.add('Pip', 'moss')!.id, storage };
  };

  it('the first finished run is the best time and the fewest falls', () => {
    const { players, id } = fresh();
    expect(players.finish(id, run({ seconds: 80, falls: 3 }))).toEqual({
      counted: true,
      first: true,
      bestTime: true,
      fewestFalls: true,
      best: { seconds: 80, falls: 3 },
      before: null,
    });
  });

  it('a run that did not reach the golden leaf never counts', () => {
    const { players, id, storage } = fresh();
    const writes = storage.writes;
    expect(players.finish(id, run({ complete: false, seconds: 5, falls: 0 }))).toMatchObject({ counted: false, bestTime: false, fewestFalls: false, best: null });
    expect(players.get(id)!.bests).toEqual({});
    expect(storage.writes).toBe(writes);
  });

  it('best time and fewest falls are kept separately, each from its own run', () => {
    const { players, id } = fresh();
    players.finish(id, run({ seconds: 80, falls: 3 }));
    // Faster, with more falls: only the time improves.
    expect(players.finish(id, run({ seconds: 70, falls: 5 }))).toMatchObject({ first: false, bestTime: true, fewestFalls: false, best: { seconds: 70, falls: 3 }, before: { seconds: 80, falls: 3 } });
    // Slower, with no falls: only the falls improve.
    expect(players.finish(id, run({ seconds: 95, falls: 0 }))).toMatchObject({ bestTime: false, fewestFalls: true, best: { seconds: 70, falls: 0 } });
    // Neither.
    expect(players.finish(id, run({ seconds: 71, falls: 1 }))).toMatchObject({ counted: true, bestTime: false, fewestFalls: false, best: { seconds: 70, falls: 0 } });
    // Matching a best is not beating it.
    expect(players.finish(id, run({ seconds: 70, falls: 0 }))).toMatchObject({ bestTime: false, fewestFalls: false });
  });

  it('each level, hero and difficulty has its own best', () => {
    const { players, id } = fresh();
    players.finish(id, run({ seconds: 80 }));
    expect(players.finish(id, run({ hero: 'Caputo', seconds: 99 })).first).toBe(true);
    expect(players.finish(id, run({ difficulty: 'hard', seconds: 120 })).first).toBe(true);
    expect(players.finish(id, run({ levelId: 'sandbox', seconds: 9 })).first).toBe(true);
    const pip = players.get(id)!;
    expect(bestFor(pip, 'bouncing-grove', 'Yaarbro', 'normal')?.seconds).toBe(80);
    expect(bestFor(pip, 'bouncing-grove', 'Caputo', 'normal')?.seconds).toBe(99);
    expect(bestFor(pip, 'bouncing-grove', 'Yaarbro', 'easy')).toBeNull();
    // The level card shows the better of the two heroes.
    expect(bestTime(pip, 'bouncing-grove', 'normal')).toBe(80);
    expect(bestTime(pip, 'bouncing-grove', 'easy')).toBeNull();
    expect(hasFinished(pip, 'sandbox', 'normal')).toBe(true);
  });

  it('refuses a run with numbers that make no sense', () => {
    const { players, id } = fresh();
    for (const bad of [{ seconds: Number.NaN }, { seconds: -1 }, { seconds: 0 }, { falls: -2 }, { falls: Infinity }, { levelId: 'Not A Level' }, { hero: 'Nobody' as never }, { difficulty: 'silly' as never }]) {
      expect(players.finish(id, run(bad)).counted).toBe(false);
    }
    expect(players.get(id)!.bests).toEqual({});
  });

  it('a run for a player who is not there saves nothing', () => {
    const { players } = fresh();
    expect(players.finish('p-nobody', run()).counted).toBe(false);
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))('the bot’s run of %s is saved and found again on the next visit', (_id, entry) => {
    const { players, id, storage } = fresh();
    const game = playWithBot(new Game(entry.build('normal'), 'normal', 'Caputo'), 300);
    const { seconds, falls, complete } = game.summary();
    expect(players.finish(id, { levelId: entry.id, hero: 'Caputo', difficulty: 'normal', seconds, falls, complete }).first).toBe(true);
    expect(bestFor(new Players(storage).get(id)!, entry.id, 'Caputo', 'normal')).toEqual({ seconds, falls: 0 });
  });
});

describe('what a level’s card shows for a player', () => {
  it('nothing finished for a new player', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'moss')!;
    expect(progressOn(pip, 'bouncing-grove')).toEqual({
      easy: { finished: false, seconds: null },
      normal: { finished: false, seconds: null },
      hard: { finished: false, seconds: null },
    });
  });

  it('each finished difficulty with its best time, the better of the two heroes, for that player and that level only', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'moss')!;
    const moss = players.add('Moss', 'sky')!;
    players.finish(pip.id, run({ difficulty: 'easy', hero: 'Yaarbro', seconds: 60 }));
    players.finish(pip.id, run({ difficulty: 'easy', hero: 'Caputo', seconds: 52.3 }));
    players.finish(pip.id, run({ difficulty: 'hard', seconds: 140 }));
    players.finish(moss.id, run({ difficulty: 'normal', seconds: 75 }));
    expect(progressOn(players.get(pip.id)!, 'bouncing-grove')).toEqual({
      easy: { finished: true, seconds: 52.3 },
      normal: { finished: false, seconds: null },
      hard: { finished: true, seconds: 140 },
    });
    expect(progressOn(players.get(moss.id)!, 'bouncing-grove').normal).toEqual({ finished: true, seconds: 75 });
    expect(progressOn(players.get(pip.id)!, 'sandbox').easy.finished).toBe(false);
  });
});

describe('what the end card says about bests', () => {
  const fresh = (): { players: Players; id: string } => {
    const players = new Players(new FakeStorage());
    return { players, id: players.add('Pip', 'moss')!.id };
  };

  it('a first finish is marked new on both, with a line of its own', () => {
    const { players, id } = fresh();
    expect(endBests(players.finish(id, run({ seconds: 80, falls: 3 })))).toEqual({
      time: { value: 80, isNew: true },
      falls: { value: 3, isNew: true },
      headline: 'First finish! That is the time to beat.',
    });
  });

  it('a faster run with more falls marks the time only, and shows the fewest falls from before', () => {
    const { players, id } = fresh();
    players.finish(id, run({ seconds: 80, falls: 3 }));
    expect(endBests(players.finish(id, run({ seconds: 70, falls: 5 })))).toEqual({
      time: { value: 70, isNew: true },
      falls: { value: 3, isNew: false },
      headline: 'New best time!',
    });
  });

  it('a slower run with fewer falls marks the falls only, and shows the best time from before', () => {
    const { players, id } = fresh();
    players.finish(id, run({ seconds: 80, falls: 3 }));
    expect(endBests(players.finish(id, run({ seconds: 95, falls: 1 })))).toEqual({
      time: { value: 80, isNew: false },
      falls: { value: 1, isNew: true },
      headline: 'Your fewest falls yet!',
    });
  });

  it('a run that beats both says so, and one that beats neither marks nothing', () => {
    const { players, id } = fresh();
    players.finish(id, run({ seconds: 80, falls: 3 }));
    expect(endBests(players.finish(id, run({ seconds: 60, falls: 0 })))?.headline).toBe('New best time, and your fewest falls!');
    expect(endBests(players.finish(id, run({ seconds: 60, falls: 0 })))).toEqual({
      time: { value: 60, isNew: false },
      falls: { value: 0, isNew: false },
      headline: null,
    });
  });

  it('a run that did not count shows no bests', () => {
    const { players, id } = fresh();
    expect(endBests(players.finish(id, run({ complete: false })))).toBeNull();
    expect(endBests(players.finish('p-nobody', run()))).toBeNull();
  });

  it('another hero or difficulty is a first finish of its own', () => {
    const { players, id } = fresh();
    players.finish(id, run({ seconds: 80 }));
    expect(endBests(players.finish(id, run({ hero: 'Caputo', seconds: 200 })))?.headline).toBe('First finish! That is the time to beat.');
  });
});
