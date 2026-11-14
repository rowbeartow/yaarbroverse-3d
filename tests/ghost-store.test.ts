// Where ghosts are kept: the browser's database, with old ghosts carried over
// from local storage. A stand-in database (fake-indexeddb) plays the browser's.

import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { GHOST_MAX_SAMPLES, encodeGhost, type Ghost } from '../src/game/ghost';
import { HEROES } from '../src/game/hero';
import { GhostStore } from '../src/save/ghost-store';
import { GHOST_PREFIX, ghostKey, loadGhost, removeGhostsOf, saveGhost, type GhostSlot } from '../src/save/ghosts';
import { FakeStorage } from './helpers/storage';

const slot = (over: Partial<GhostSlot> = {}): GhostSlot => ({ playerId: 'p-pip', levelId: 'bouncing-grove', hero: 'Yaarbro', difficulty: 'normal', ...over });

/** The biggest ghost there can be: every sample used, each a long way from the start. */
const biggest = (): Ghost => ({
  interval: 4,
  steps: GHOST_MAX_SAMPLES * 4,
  samples: Array.from({ length: GHOST_MAX_SAMPLES + 1 }, (_, i) => ({
    x: Math.sin(i) * 200,
    y: Math.cos(i * 0.7) * 50,
    z: -i * 0.25,
    facing: i,
    grounded: i % 2 === 0,
    rolling: i % 3 === 0,
    pouncing: i % 5 === 0,
    cut: false,
  })),
});
const small = (steps = 120): Ghost => ({
  interval: 4,
  steps,
  samples: Array.from({ length: steps / 4 + 1 }, (_, i) => ({ x: i * 0.1, y: 0, z: -i, facing: 0, grounded: true, rolling: false, pouncing: false, cut: false })),
});

/** Lets the stand-in database finish what it was asked to do. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe('the ghost store', () => {
  it('keeps ghosts in the database, where a fresh visit finds them', async () => {
    const databases = new IDBFactory();
    const first = new GhostStore(databases, new FakeStorage());
    await first.open();
    expect(first.kept).toBe('database');
    expect(saveGhost(first, slot(), small())).toBe(true);
    await settle();
    const again = new GhostStore(databases, new FakeStorage());
    await again.open();
    expect(loadGhost(again, slot())?.steps).toBe(120);
  });

  it('carries over ghosts already in local storage, then takes them out of local storage', async () => {
    const local = new FakeStorage();
    local.setItem(ghostKey(slot()), encodeGhost(small(80)) as string);
    local.setItem(ghostKey(slot({ hero: 'Caputo' })), encodeGhost(small(40)) as string);
    local.setItem('yaarbroverse-3d:players', '{"kept":true}');
    const databases = new IDBFactory();
    const store = new GhostStore(databases, local);
    await store.open();
    expect(loadGhost(store, slot())?.steps).toBe(80);
    expect(loadGhost(store, slot({ hero: 'Caputo' }))?.steps).toBe(40);
    // Gone from local storage; the players' entry is not a ghost and stays.
    expect(local.getItem(ghostKey(slot()))).toBeNull();
    expect(local.getItem('yaarbroverse-3d:players')).toBe('{"kept":true}');
    // And on the next visit they come from the database.
    await settle();
    const next = new GhostStore(databases, new FakeStorage());
    await next.open();
    expect(loadGhost(next, slot())?.steps).toBe(80);
  });

  it('keeps a ghost already in the database over an older copy left in local storage', async () => {
    const databases = new IDBFactory();
    const store = new GhostStore(databases, new FakeStorage());
    await store.open();
    saveGhost(store, slot(), small(200));
    await settle();
    const local = new FakeStorage();
    local.setItem(ghostKey(slot()), encodeGhost(small(80)) as string);
    const later = new GhostStore(databases, local);
    await later.open();
    expect(loadGhost(later, slot())?.steps).toBe(200);
    expect(local.getItem(ghostKey(slot()))).toBeNull();
  });

  it('removes every ghost a player has, from the database too', async () => {
    const databases = new IDBFactory();
    const store = new GhostStore(databases, new FakeStorage());
    await store.open();
    saveGhost(store, slot(), small());
    saveGhost(store, slot({ hero: 'Caputo' }), small());
    saveGhost(store, slot({ playerId: 'p-moss' }), small());
    removeGhostsOf(store, 'p-pip');
    await settle();
    const next = new GhostStore(databases, new FakeStorage());
    await next.open();
    expect(loadGhost(next, slot())).toBeNull();
    expect(loadGhost(next, slot({ hero: 'Caputo' }))).toBeNull();
    expect(loadGhost(next, slot({ playerId: 'p-moss' }))).not.toBeNull();
  });

  it('keeps a ghost saved before the database has opened', async () => {
    const databases = new IDBFactory();
    const store = new GhostStore(databases, new FakeStorage());
    const opening = store.open();
    saveGhost(store, slot(), small(60));
    await opening;
    await settle();
    const next = new GhostStore(databases, new FakeStorage());
    await next.open();
    expect(loadGhost(next, slot())?.steps).toBe(60);
  });

  it('falls back to local storage where there is no database, and never throws', async () => {
    const local = new FakeStorage();
    const store = new GhostStore(null, local);
    await store.open();
    expect(store.kept).toBe('local');
    expect(saveGhost(store, slot(), small())).toBe(true);
    expect(local.getItem(ghostKey(slot()))).not.toBeNull();
    const broken = { open: () => { throw new Error('Not allowed'); } } as unknown as IDBFactory;
    const blocked = new GhostStore(broken, null);
    await blocked.open();
    expect(blocked.kept).toBe('memory');
    expect(saveGhost(blocked, slot(), small())).toBe(true);
    expect(loadGhost(blocked, slot())?.steps).toBe(120);
  });

  it('has room for the worst case across the roadmap: four players, five levels, both heroes, every difficulty, every ghost as big as it gets', async () => {
    const databases = new IDBFactory();
    const store = new GhostStore(databases, new FakeStorage());
    await store.open();
    const big = biggest();
    const text = encodeGhost(big) as string;
    expect(text.length).toBeLessThan(26_000);
    let count = 0;
    for (const playerId of ['p-1', 'p-2', 'p-3', 'p-4']) {
      for (const levelId of ['bouncing-grove', 'lake', 'pike', 'selkirks', 'climbing']) {
        for (const hero of HEROES) {
          for (const difficulty of DIFFICULTIES) {
            expect(saveGhost(store, { playerId, levelId, hero, difficulty }, big)).toBe(true);
            count += 1;
          }
        }
      }
    }
    expect(count).toBe(120);
    // About 3.1 million characters: more than local storage's 5 MB in Safari, which counts two bytes a character.
    expect(text.length * count * 2).toBeGreaterThan(5 * 1024 * 1024);
    await settle();
    const next = new GhostStore(databases, new FakeStorage());
    await next.open();
    expect(next.length).toBe(120);
    expect([...Array(next.length).keys()].every((i) => next.key(i)?.startsWith(GHOST_PREFIX))).toBe(true);
  });
});
