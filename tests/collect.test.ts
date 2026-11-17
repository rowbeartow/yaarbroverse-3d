// Collecting: huckleberries and hidden leaves (src/game/collect.ts).

import { describe, expect, it } from 'vitest';
import { COLLECT, berryTrail, pickupCounts, type Pickup } from '../src/game/collect';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game } from '../src/game/game';
import { HEROES } from '../src/game/hero';
import { LEVELS } from '../src/levels';
import { playWithBot } from './helpers/bot';
import { AWAY, RIGHT, hold, start, yard } from './helpers/yard';

const berry = (id: string, x: number, z = 0, y = COLLECT.hang): Pickup => ({ id, kind: 'berry', x, y, z });

describe('collecting', () => {
  it('picks up what the hero touches, once, and says so', () => {
    const game = start(yard([], { pickups: [berry('b-1', 2), berry('b-2', 4), { id: 'leaf-1', kind: 'leaf', x: 6, y: COLLECT.hang, z: 0 }] }));
    const seen: string[] = [];
    hold(game, RIGHT, 1.6, () => {
      for (const event of game.events) if (event.type === 'pickup') seen.push(`${event.kind}:${event.id}:${event.found}`);
    });
    expect(seen).toEqual(['berry:b-1:1', 'berry:b-2:2', 'leaf:leaf-1:1']);
    expect(game.berries).toBe(2);
    expect(game.leaves).toBe(1);
    // Walking back through where they hung picks up nothing more.
    hold(game, { moveX: -1 }, 1.6);
    expect(game.berries).toBe(2);
    expect(game.summary()).toMatchObject({ berries: 2, berriesIn: 2, leaves: ['leaf-1'], leavesIn: 1 });
  });

  it('leaves alone what the hero does not reach', () => {
    const game = start(yard([], { pickups: [berry('high', 2, 0, 4), berry('aside', 2, 3)] }));
    hold(game, RIGHT, 1);
    expect(game.berries).toBe(0);
  });

  it('a fall takes nothing away', () => {
    const game = start(yard([], { pickups: [berry('b-1', 0, -2)] }));
    hold(game, AWAY, 3);
    expect(game.falls).toBe(1);
    expect(game.berries).toBe(1);
    expect(game.collected.has('b-1')).toBe(true);
  });

  it('changes nothing else: a run with pickups moves exactly as one without', () => {
    const plain = start(yard());
    const berried = start(yard([], { pickups: berryTrail('t', { x: 0, y: COLLECT.hang, z: 0 }, { x: 8, y: COLLECT.hang, z: 0 }, 9) }));
    for (const game of [plain, berried]) hold(game, { moveX: 1, jump: true }, 2);
    expect([berried.x, berried.y, berried.z]).toEqual([plain.x, plain.y, plain.z]);
    expect(berried.berries).toBeGreaterThan(0);
  });

  it('lays a trail evenly from end to end, lifted in the middle by its arc', () => {
    const trail = berryTrail('swing', { x: 0, y: 1, z: 0 }, { x: 8, y: 1, z: -4 }, 5, 2);
    expect(trail.map((b) => b.id)).toEqual(['swing-1', 'swing-2', 'swing-3', 'swing-4', 'swing-5']);
    expect(trail[0]).toMatchObject({ x: 0, y: 1, z: 0 });
    expect(trail[4]).toMatchObject({ x: 8, y: 1, z: -4 });
    expect(trail[2]).toMatchObject({ x: 4, y: 3, z: -2 });
    expect(pickupCounts(trail)).toEqual({ berry: 5, leaf: 0 });
  });
});

describe.each(LEVELS.filter((level) => DIFFICULTIES.some((d) => level.build(d).pickups?.length)).map((level) => [level.id, level] as const))('what there is to collect in %s', (_id, entry) => {
  it.each(DIFFICULTIES)('on %s every pickup has its own id, and none hangs inside a solid', (difficulty) => {
    const level = entry.build(difficulty);
    const pickups = level.pickups ?? [];
    expect(new Set(pickups.map((p) => p.id)).size).toBe(pickups.length);
    for (const pickup of pickups) {
      expect(pickup.id).toMatch(/^[a-z0-9-]{1,40}$/);
      const inside = level.solids.find(
        (s) => !s.motion && pickup.y < s.top && pickup.y > s.bottom && Math.abs(pickup.x - s.x) < s.halfX && Math.abs(pickup.z - s.z) < s.halfZ,
      );
      expect(inside?.id, `${pickup.id} is inside ${inside?.id}`).toBeUndefined();
    }
  });

  it.each(DIFFICULTIES.flatMap((d) => HEROES.map((h) => [d, h] as const)))('on %s as %s the bot still finishes, and a run along the route finds berries', (difficulty, hero) => {
    const game = playWithBot(new Game(entry.build(difficulty), difficulty, hero), 400);
    expect(game.complete).toBe(true);
    if (pickupCounts(game.level.pickups).berry > 0) expect(game.berries).toBeGreaterThan(0);
  });
});
