import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, isDifficulty } from '../src/game/difficulty';
import { fullJumpHeight, jumpReach } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { GROVE_BLURB, GROVE_DIFFICULTY } from '../src/levels/bouncing-grove/difficulty';
import { GROVE_SHAPE, buildGrove } from '../src/levels/bouncing-grove/layout';

const { easy, normal, hard } = GROVE_DIFFICULTY;
const byId = (level: Level, id: string): Solid => {
  const found = level.solids.find((s) => s.id === id);
  if (!found) throw new Error(`No solid called ${id}`);
  return found;
};
const count = (level: Level, kind: Solid['kind']): number => level.solids.filter((s) => s.kind === kind).length;

/** Open air between two solids, seen from above. */
const airBetween = (a: Solid, b: Solid): number => {
  const edge = (s: Solid, x: number, z: number): number =>
    s.shape === 'round'
      ? Math.max(Math.hypot(x - s.x, z - s.z) - s.halfX, 0)
      : Math.hypot(Math.max(Math.abs(x - s.x) - s.halfX, 0), Math.max(Math.abs(z - s.z) - s.halfZ, 0));
  if (a.shape === 'round') return edge(b, a.x, a.z) - a.halfX;
  if (b.shape === 'round') return edge(a, b.x, b.z) - b.halfX;
  return Math.hypot(
    Math.max(Math.abs(a.x - b.x) - a.halfX - b.halfX, 0),
    Math.max(Math.abs(a.z - b.z) - a.halfZ - b.halfZ, 0),
  );
};

describe('difficulty names', () => {
  it('are Easy, Normal and Hard', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard']);
    expect(isDifficulty('easy')).toBe(true);
    expect(isDifficulty('impossible')).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
  });
});

describe('Bouncing Grove difficulty numbers', () => {
  it('has a full set of numbers and a start-screen line for each difficulty', () => {
    const names = Object.keys(normal).sort();
    for (const difficulty of DIFFICULTIES) {
      const numbers = GROVE_DIFFICULTY[difficulty];
      expect(Object.keys(numbers).sort()).toEqual(names);
      for (const value of Object.values(numbers)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      expect(GROVE_BLURB[difficulty].length).toBeGreaterThan(0);
    }
  });

  it('gives Easy the widest footing and Hard the narrowest', () => {
    for (const key of ['logWidth', 'stumpRadius', 'mushroomRadius'] as const) {
      expect(easy[key]).toBeGreaterThan(normal[key]);
      expect(normal[key]).toBeGreaterThan(hard[key]);
    }
  });

  it('gives Easy the shortest jumps and Hard the longest', () => {
    for (const key of ['logGap', 'stumpGap', 'stumpRise', 'mushroomGap'] as const) {
      expect(easy[key]).toBeLessThan(normal[key]);
      expect(normal[key]).toBeLessThan(hard[key]);
    }
  });

  it('gives Easy the fewest stumps and mushrooms to cross and Hard the most', () => {
    for (const key of ['stumpCount', 'mushroomChain'] as const) {
      expect(easy[key]).toBeLessThan(normal[key]);
      expect(normal[key]).toBeLessThan(hard[key]);
    }
  });

  it('gives Easy the most help with edges and Hard the least', () => {
    for (const key of ['coyoteTime', 'ledgeHelp'] as const) {
      expect(easy[key]).toBeGreaterThan(normal[key]);
      expect(normal[key]).toBeGreaterThan(hard[key]);
    }
  });

  it('makes every bank safe on Easy and Normal, and only the first on Hard', () => {
    expect([easy.safeBanks, normal.safeBanks, hard.safeBanks]).toEqual([3, 3, 1]);
  });
});

describe.each(DIFFICULTIES)('the grove built on %s', (difficulty) => {
  const numbers = GROVE_DIFFICULTY[difficulty];
  const level = buildGrove(difficulty);

  it('uses the numbers from the difficulty file', () => {
    expect(byId(level, 'log-1').halfX * 2).toBeCloseTo(numbers.logWidth, 5);
    expect(airBetween(byId(level, 'log-1'), byId(level, 'log-2'))).toBeCloseTo(numbers.logGap, 5);
    expect(count(level, 'stump')).toBe(numbers.stumpCount);
    expect(byId(level, 'stump-1').halfX).toBe(numbers.stumpRadius);
    expect(airBetween(byId(level, 'stump-1'), byId(level, 'stump-2'))).toBeCloseTo(numbers.stumpGap, 5);
    expect(byId(level, 'stump-2').top - byId(level, 'stump-1').top).toBeCloseTo(numbers.stumpRise, 5);
    // One mushroom always grows on the second bank; the rest are the chain.
    expect(count(level, 'mushroom')).toBe(numbers.mushroomChain + 1);
    expect(byId(level, 'mushroom-2').halfX).toBe(numbers.mushroomRadius);
    expect(airBetween(byId(level, 'high-log'), byId(level, 'mushroom-2'))).toBeCloseTo(numbers.mushroomGap, 5);
    expect(level.solids.filter((s) => s.safe).length).toBe(numbers.safeBanks);
    expect(level.coyoteTime).toBe(numbers.coyoteTime);
    expect(level.ledgeHelp).toBe(numbers.ledgeHelp);
  });

  it('starts the hero on a safe bank', () => {
    const first = byId(level, level.route[0]);
    expect(first.safe).toBe(true);
    expect(level.spawn.y).toBe(first.top);
  });

  it('lists every solid once in the route', () => {
    expect(new Set(level.route).size).toBe(level.route.length);
    expect([...level.route].sort()).toEqual(level.solids.map((s) => s.id).sort());
  });

  it('tucks the leaf up high, over the last bough', () => {
    const bough = byId(level, level.route[level.route.length - 1]);
    expect(bough.kind).toBe('bough');
    expect(level.leaf.y).toBeGreaterThan(bough.top);
    expect(level.leaf.y - bough.top).toBeLessThan(fullJumpHeight());
    expect(Math.abs(level.leaf.x - bough.x)).toBeLessThan(bough.halfX);
    expect(Math.abs(level.leaf.z - bough.z)).toBeLessThan(bough.halfZ);
    expect(bough.top).toBeGreaterThan(5);
  });

  it('keeps every jump within four fifths of what a running jump can cover', () => {
    for (let i = 1; i < level.route.length; i += 1) {
      const from = byId(level, level.route[i - 1]);
      const to = byId(level, level.route[i]);
      if (from.bounce) continue; // Leaving a mushroom is a bounce, checked below.
      const air = airBetween(from, to);
      if (air <= 0) continue; // Touching or overlapping: a walk or a hop up.
      expect(air, `${from.id} to ${to.id}`).toBeLessThanOrEqual(jumpReach(to.top - from.top) * 0.8);
    }
  });

  it('puts every ledge after a mushroom within a bounce, and too high for a plain jump', () => {
    const bounceHeight = GROVE_SHAPE.mushroomBounce ** 2 / (2 * 30);
    for (let i = 1; i < level.route.length; i += 1) {
      const from = byId(level, level.route[i - 1]);
      const to = byId(level, level.route[i]);
      if (!from.bounce || to.bounce) continue;
      expect(to.top - from.top, `${from.id} to ${to.id}`).toBeLessThan(bounceHeight * 0.8);
      expect(to.top - from.top, `${from.id} to ${to.id}`).toBeGreaterThan(fullJumpHeight());
    }
  });

  it('leaves room to walk around the mushroom on the second bank', () => {
    const bank = byId(level, 'bank-2');
    const mushroom = byId(level, 'mushroom-1');
    expect(mushroom.halfX).toBeLessThan(bank.halfX - 1);
    expect(mushroom.z - mushroom.halfZ).toBeGreaterThan(bank.z - bank.halfZ);
  });
});
