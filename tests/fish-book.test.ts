// The fish book: every fish a player lands, counted by kind, with the biggest
// of each. Saved per player, whether or not the run was finished, and never
// taken away but by a grown-up's reset. The names here are made up.

import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { SPECIES } from '../src/game/fishing';
import { buildLake } from '../src/levels/cocolalla/layout';
import { PLAYERS_KEY, Players, fishBookOf, isBiggestYet } from '../src/save/players';
import { biggestWords, catchWords, fishingButton, fishingNews } from '../src/ui/fishing-words';
import { catchOne } from './helpers/fisher';
import { FakeStorage } from './helpers/storage';

describe('the fish book', () => {
  it('starts empty: every kind is there, with none caught and no biggest', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    expect(fishBookOf(pip)).toEqual({ perch: { count: 0, biggest: null }, bass: { count: 0, biggest: null }, trout: { count: 0, biggest: null }, pike: { count: 0, biggest: null } });
    expect(fishBookOf(null).pike).toEqual({ count: 0, biggest: null });
  });

  it('adds up how many of each kind, and keeps the biggest of each', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    expect(players.land(pip.id, [{ species: 'perch', size: 18 }, { species: 'perch', size: 24 }, { species: 'bass', size: 41 }])).toEqual({
      caught: { perch: 2, bass: 1 },
      biggest: { perch: 24, bass: 41 },
    });
    // A later run: a smaller perch counts but sets no biggest; a bigger bass does both.
    expect(players.land(pip.id, [{ species: 'perch', size: 20 }, { species: 'bass', size: 47 }])).toEqual({ caught: { perch: 1, bass: 1 }, biggest: { bass: 47 } });
    const book = fishBookOf(players.get(pip.id));
    expect(book.perch).toEqual({ count: 3, biggest: 24 });
    expect(book.bass).toEqual({ count: 2, biggest: 47 });
    expect(book.trout).toEqual({ count: 0, biggest: null });
  });

  it('matching a biggest is not beating it', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    players.land(pip.id, [{ species: 'trout', size: 38 }]);
    expect(players.land(pip.id, [{ species: 'trout', size: 38 }]).biggest).toEqual({});
  });

  it('is each player’s own, and is still there after the page is closed and opened', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'sky')!;
    const moss = players.add('Moss', 'moss')!;
    players.land(pip.id, [{ species: 'pike', size: 96 }]);
    players.land(moss.id, [{ species: 'perch', size: 14 }, { species: 'perch', size: 15 }]);
    const later = new Players(storage);
    expect(fishBookOf(later.get(pip.id))).toMatchObject({ pike: { count: 1, biggest: 96 }, perch: { count: 0, biggest: null } });
    expect(fishBookOf(later.get(moss.id))).toMatchObject({ pike: { count: 0, biggest: null }, perch: { count: 2, biggest: 15 } });
  });

  it('a run with no fish saves nothing, and an unknown player is no one', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'sky')!;
    const before = storage.getItem(PLAYERS_KEY);
    expect(players.land(pip.id, [])).toEqual({ caught: {}, biggest: {} });
    expect(storage.getItem(PLAYERS_KEY)).toBe(before);
    expect(players.land('nobody', [{ species: 'bass', size: 30 }])).toEqual({ caught: {}, biggest: {} });
    expect(pip.fish).toBeUndefined();
  });

  it('drops a catch that is not a fish, and keeps the rest', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    const odd = [{ species: 'shark', size: 30 }, { species: 'bass', size: -4 }, { species: 'bass', size: 9000 }, { species: 'bass', size: Number.NaN }, { species: 'bass', size: 33 }] as never;
    expect(players.land(pip.id, odd)).toEqual({ caught: { bass: 1 }, biggest: { bass: 33 } });
  });

  it('damaged saved data is dropped piece by piece, and the game carries on', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'sky')!;
    players.land(pip.id, [{ species: 'perch', size: 22 }, { species: 'bass', size: 40 }]);
    const saved = JSON.parse(storage.getItem(PLAYERS_KEY)!);
    const record = saved.players.find((each: { id: string }) => each.id === pip.id);
    record.fish.bass = { count: 'lots', biggest: 40 };
    record.fish.trout = { count: 2, biggest: 99999 };
    record.fish.eel = { count: 1, biggest: 50 };
    storage.setItem(PLAYERS_KEY, JSON.stringify(saved));
    const later = new Players(storage);
    expect(later.get(pip.id)!.fish).toEqual({ perch: { count: 1, biggest: 22 } });
    record.fish = 'a string';
    storage.setItem(PLAYERS_KEY, JSON.stringify(saved));
    expect(new Players(storage).get(pip.id)!.fish).toBeUndefined();
  });

  it('a grown-up’s reset empties it; nothing else does', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    players.land(pip.id, [{ species: 'trout', size: 52 }]);
    players.setChoice(pip.id, 'Caputo', 'hard');
    expect(fishBookOf(players.get(pip.id)).trout.count).toBe(1);
    players.resetProgress(pip.id);
    expect(players.get(pip.id)!.fish).toBeUndefined();
  });

  it('"biggest yet" counts the book and the fish landed earlier in the same run', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    expect(isBiggestYet(pip, [], { species: 'perch', size: 15 })).toBe(true);
    expect(isBiggestYet(pip, [{ species: 'perch', size: 20 }], { species: 'perch', size: 15 })).toBe(false);
    expect(isBiggestYet(pip, [{ species: 'bass', size: 50 }], { species: 'perch', size: 15 })).toBe(true);
    players.land(pip.id, [{ species: 'perch', size: 26 }]);
    expect(isBiggestYet(players.get(pip.id), [], { species: 'perch', size: 26 })).toBe(false);
    expect(isBiggestYet(players.get(pip.id), [], { species: 'perch', size: 27 })).toBe(true);
    expect(isBiggestYet(null, [], { species: 'pike', size: 60 })).toBe(true);
  });

  it('a real run’s catch goes in: the bot lands every kind on the lake and the book has them', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    const game = new Game(buildLake('easy'), 'easy', 'Yaarbro');
    game.startOn('jetty');
    for (const species of SPECIES) expect(catchOne(game, species), species).not.toBeNull();
    // The run is left without reaching the golden leaf: the fish still count.
    expect(game.complete).toBe(false);
    const outcome = players.land(pip.id, game.summary().fish);
    const book = fishBookOf(players.get(pip.id));
    for (const species of SPECIES) {
      expect(book[species].count, species).toBeGreaterThanOrEqual(1);
      expect(book[species].biggest, species).toBe(outcome.biggest[species]);
    }
    expect(game.summary().fishing).toBe(true);
  });
});

describe('what the game says about fishing', () => {
  it('the round button names what it does at each moment', () => {
    expect(fishingButton(false, 'off')).toBeNull();
    expect(fishingButton(true, 'off')).toBe('Fish');
    expect(fishingButton(true, 'aim')).toBe('Cast');
    expect(fishingButton(true, 'wait')).toBe('Wait');
    expect(fishingButton(true, 'bite')).toBe('Hook!');
    expect(fishingButton(true, 'hooked')).toBe('Reel');
  });

  it('a landed fish is named with its size, and said to be the biggest when it is', () => {
    expect(fishingNews({ what: 'landed', species: 'bass', size: 41 }, false, false)?.text).toBe('Bass! 41 cm.');
    expect(fishingNews({ what: 'landed', species: 'pike', size: 96 }, true, true, true)?.text).toBe('Pike! 96 cm. Your biggest yet!');
  });

  it('on Easy nothing tells the player to hurry or to let go', () => {
    expect(fishingNews({ what: 'bite', species: 'perch' }, false, true)?.text).toBe('A bite! Hold X to reel it in.');
    expect(fishingNews({ what: 'bite', species: 'perch' }, false, false)?.text).toBe('A bite! Press X now!');
    expect(fishingNews({ what: 'thrash', species: 'perch' }, true, true)).toBeNull();
    expect(fishingNews({ what: 'thrash', species: 'perch' }, true, false)?.text).toContain('Let the line run');
    expect(fishingNews({ what: 'hooked', species: 'perch' }, true, false)?.text).toContain('the round button');
  });

  it('a run’s catch reads as a list, and its biggest as a line each', () => {
    expect(catchWords({})).toBe('');
    expect(catchWords({ bass: 1, perch: 2 })).toBe('2 perch, 1 bass');
    expect(biggestWords({})).toBe('');
    expect(biggestWords({ bass: 41 })).toBe('Biggest bass yet: 41 cm!');
  });
});
