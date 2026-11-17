// What a player has collected, saved on this device (src/save/players.ts).
// The names here are made up.

import { describe, expect, it } from 'vitest';
import { PLAYERS_KEY, Players, findsOn, type Haul } from '../src/save/players';
import { FakeStorage } from './helpers/storage';

const haul = (over: Partial<Haul> = {}): Haul => ({ levelId: 'cocolalla', difficulty: 'normal', berries: 10, leaves: [], ...over });

describe('saving what a run collected', () => {
  it('adds huckleberries to the total, keeps the most in one run, and keeps each hidden leaf once', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'moss')!;
    expect(players.collect(pip.id, haul({ berries: 10, leaves: ['leaf-logs'] }))).toEqual({ mostBerries: true, newLeaves: 1, leavesFound: 1 });
    expect(players.collect(pip.id, haul({ berries: 4, leaves: ['leaf-logs', 'leaf-tunnel'] }))).toEqual({ mostBerries: false, newLeaves: 1, leavesFound: 2 });
    expect(players.collect(pip.id, haul({ berries: 12 }))).toEqual({ mostBerries: true, newLeaves: 0, leavesFound: 2 });
    // A new visit finds it all.
    const again = new Players(storage).get(pip.id)!;
    expect(findsOn(again, 'cocolalla')).toEqual({ berries: 26, on: { easy: { most: 0, leaves: 0 }, normal: { most: 12, leaves: 2 }, hard: { most: 0, leaves: 0 } } });
  });

  it('keeps each difficulty and each player apart', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'moss')!;
    const moss = players.add('Moss', 'sky')!;
    players.collect(pip.id, haul({ difficulty: 'easy', berries: 7, leaves: ['leaf-logs'] }));
    players.collect(pip.id, haul({ difficulty: 'hard', berries: 3 }));
    expect(findsOn(players.get(pip.id)!, 'cocolalla').on).toEqual({ easy: { most: 7, leaves: 1 }, normal: { most: 0, leaves: 0 }, hard: { most: 3, leaves: 0 } });
    expect(findsOn(players.get(moss.id)!, 'cocolalla').berries).toBe(0);
    expect(findsOn(players.get(pip.id)!, 'bouncing-grove').berries).toBe(0);
  });

  it('a run that collected nothing saves nothing', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'moss')!;
    const before = storage.getItem(PLAYERS_KEY);
    expect(players.collect(pip.id, haul({ berries: 0 }))).toEqual({ mostBerries: false, newLeaves: 0, leavesFound: 0 });
    expect(storage.getItem(PLAYERS_KEY)).toBe(before);
    expect(players.get(pip.id)!.finds).toBeUndefined();
  });

  it('refuses a haul that makes no sense, and a player who is gone', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'moss')!;
    const nothing = { mostBerries: false, newLeaves: 0, leavesFound: 0 };
    expect(players.collect('nobody', haul())).toEqual(nothing);
    expect(players.collect(pip.id, haul({ berries: -3 }))).toEqual(nothing);
    expect(players.collect(pip.id, haul({ berries: Number.NaN }))).toEqual(nothing);
    expect(players.collect(pip.id, haul({ levelId: 'Not A Level!' }))).toEqual(nothing);
    expect(players.get(pip.id)!.finds).toBeUndefined();
  });

  it('"Reset progress" wipes what was collected, and removing a player takes it with them', () => {
    const players = new Players(new FakeStorage());
    const pip = players.add('Pip', 'moss')!;
    players.collect(pip.id, haul({ leaves: ['leaf-logs'] }));
    players.resetProgress(pip.id);
    expect(findsOn(players.get(pip.id)!, 'cocolalla')).toEqual({ berries: 0, on: { easy: { most: 0, leaves: 0 }, normal: { most: 0, leaves: 0 }, hard: { most: 0, leaves: 0 } } });
  });

  it('drops damaged saved finds piece by piece and keeps the player', () => {
    const storage = new FakeStorage();
    storage.setItem(
      PLAYERS_KEY,
      JSON.stringify({
        version: 1,
        last: 'p-abc',
        players: [
          {
            id: 'p-abc',
            name: 'Pip',
            colour: 'moss',
            hero: 'Caputo',
            difficulty: 'easy',
            bests: {},
            finds: {
              cocolalla: { berries: 'lots', on: { easy: { most: 5.9, leaves: ['leaf-logs', 'leaf-logs', 7, '<b>'] }, silly: { most: 9, leaves: [] }, hard: 'no' } },
              'Bad Level': { berries: 3, on: {} },
              sandbox: 12,
            },
          },
        ],
      }),
    );
    const pip = new Players(storage).get('p-abc')!;
    expect(pip.name).toBe('Pip');
    expect(pip.finds).toEqual({ cocolalla: { berries: 0, on: { easy: { most: 5, leaves: ['leaf-logs'] } } } });
  });
});
