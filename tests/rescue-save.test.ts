// What Walblum's rescue saves for a player, and what happens to a best time
// set on a level's older course. The names here are made up.

import { describe, expect, it } from 'vitest';
import { COCOLALLA } from '../src/levels/cocolalla/level';
import { PLAYERS_KEY, Players, bestFor } from '../src/save/players';
import { FakeStorage } from './helpers/storage';

describe('the rescue, saved', () => {
  it('is remembered for the player who made it, across visits, and for nobody else', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'sky')!;
    const moss = players.add('Moss', 'berry')!;
    expect(pip.rescued).toBeUndefined();
    expect(players.rescue(pip.id)).toBe(true);
    // Only the first time is news.
    expect(players.rescue(pip.id)).toBe(false);
    const later = new Players(storage);
    expect(later.get(pip.id)!.rescued).toBe(true);
    expect(later.get(moss.id)!.rescued).toBeUndefined();
    expect(later.rescue('nobody')).toBe(false);
  });

  it('a grown-up\'s reset forgets it, and damaged saved data is not taken for a rescue', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'sky')!;
    players.rescue(pip.id);
    players.resetProgress(pip.id);
    expect(new Players(storage).get(pip.id)!.rescued).toBeUndefined();
    const saved = JSON.parse(storage.getItem(PLAYERS_KEY)!);
    saved.players[0].rescued = 'yes';
    storage.setItem(PLAYERS_KEY, JSON.stringify(saved));
    expect(new Players(storage).get(pip.id)!.rescued).toBeUndefined();
  });
});

describe('a best time from an older course', () => {
  const run = { levelId: 'cocolalla', hero: 'Yaarbro', difficulty: 'normal', falls: 0, complete: true } as const;

  it('the lake is on its second course: the monster pike stands before the leaf', () => {
    expect(COCOLALLA.course).toBe(2);
  });

  it('gives way to the first run on the new course, however slow, and from then on only to a faster one', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'sky')!;
    // Before the pike: a minute.
    players.finish(pip.id, { ...run, seconds: 62 });
    expect(bestFor(players.get(pip.id)!, 'cocolalla', 'Yaarbro', 'normal')).toEqual({ seconds: 62, falls: 0 });
    // The first run with the pike is far slower, and is the new best all the same.
    const first = players.finish(pip.id, { ...run, seconds: 140, falls: 2, course: 2 });
    expect(first).toMatchObject({ counted: true, first: true, bestTime: true, fewestFalls: true, before: null });
    expect(bestFor(players.get(pip.id)!, 'cocolalla', 'Yaarbro', 'normal')).toEqual({ seconds: 140, falls: 2, course: 2 });
    // After that it is a best like any other.
    expect(players.finish(pip.id, { ...run, seconds: 150, course: 2 }).bestTime).toBe(false);
    expect(players.finish(pip.id, { ...run, seconds: 131, course: 2 }).bestTime).toBe(true);
    // And it is kept across visits.
    expect(bestFor(new Players(storage).get(pip.id)!, 'cocolalla', 'Yaarbro', 'normal')).toEqual({ seconds: 131, falls: 0, course: 2 });
  });

  it('a level that has not changed keeps its bests as they are', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'sky')!;
    players.finish(pip.id, { ...run, levelId: 'bouncing-grove', seconds: 80 });
    expect(players.finish(pip.id, { ...run, levelId: 'bouncing-grove', seconds: 90 }).bestTime).toBe(false);
    expect(bestFor(players.get(pip.id)!, 'bouncing-grove', 'Yaarbro', 'normal')).toEqual({ seconds: 80, falls: 0 });
  });
});
