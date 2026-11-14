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
      // Every other number is above zero, but for the two that switch a scout's walking and chasing off.
      const { scoutPatrol, scoutChase, enemyAimLine, chief, mossFalls, mossSag, windStart, ...rest } = numbers;
      // Whether moss falls is a switch; how far it sags is 0 where it falls; the boughs' rhythm may start anywhere.
      expect(typeof mossFalls).toBe('boolean');
      expect(mossSag).toBeGreaterThanOrEqual(0);
      expect(windStart).toBeGreaterThanOrEqual(0);
      expect(windStart).toBeLessThan(1);
      // The chief's numbers have their own tests (tests/chief.test.ts).
      expect(chief.health).toBeGreaterThan(0);
      expect(typeof enemyAimLine).toBe('boolean');
      for (const value of Object.values(rest).flat()) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      for (const value of [scoutPatrol, scoutChase]) expect(value).toBeGreaterThanOrEqual(0);
      expect(GROVE_BLURB[difficulty].length).toBeGreaterThan(0);
    }
  });

  it('gives Easy the widest footing and Hard the narrowest', () => {
    for (const key of ['logWidth', 'stumpRadius', 'shelfSize', 'mushroomRadius', 'boughWidth'] as const) {
      expect(easy[key]).toBeGreaterThan(normal[key]);
      expect(normal[key]).toBeGreaterThan(hard[key]);
    }
  });

  it('gives Easy the shortest jumps and Hard the longest', () => {
    for (const key of ['firstLogGap', 'logGap', 'stumpGap', 'stumpRise', 'shelfGap', 'shelfStep', 'tipGap', 'mossGap', 'windGap', 'boughGap'] as const) {
      expect(easy[key]).toBeLessThan(normal[key]);
      expect(normal[key]).toBeLessThan(hard[key]);
    }
  });

  it('gives Easy the fewest stumps, tipping logs and moss pads to cross and Hard the most', () => {
    for (const key of ['stumpCount', 'tipCount', 'mossCount'] as const) {
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

  it('opens with a hop shorter than the jumps that follow, on every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const numbers = GROVE_DIFFICULTY[difficulty];
      expect(numbers.firstLogGap).toBeLessThan(numbers.logGap);
      expect(numbers.logCount).toBeGreaterThanOrEqual(3);
    }
    expect(hard.logCount).toBeGreaterThan(normal.logCount);
  });

  it('makes every bank a checkpoint on Easy and Normal, and fewer on Hard', () => {
    expect(easy.checkpoints).toEqual(normal.checkpoints);
    expect(hard.checkpoints.length).toBeLessThan(normal.checkpoints.length);
    for (const bank of hard.checkpoints) expect(normal.checkpoints).toContain(bank);
  });
});

describe.each(DIFFICULTIES)('the grove built on %s', (difficulty) => {
  const numbers = GROVE_DIFFICULTY[difficulty];
  const level = buildGrove(difficulty);

  it('uses the numbers from the difficulty file', () => {
    expect(byId(level, 'log-1').halfX * 2).toBeCloseTo(numbers.logWidth, 5);
    // The opening logs, two along the bottom of the ravine, the two high logs, the tipping logs and the log before the windy boughs.
    expect(count(level, 'log')).toBe(numbers.logCount + 5 + numbers.tipCount);
    expect(airBetween(byId(level, 'log-1'), byId(level, 'log-2'))).toBeCloseTo(numbers.firstLogGap, 5);
    expect(airBetween(byId(level, 'log-2'), byId(level, 'log-3'))).toBeCloseTo(numbers.logGap, 5);
    // Stumps low down, and none anywhere else.
    expect(count(level, 'stump')).toBe(numbers.stumpCount);
    expect(byId(level, 'stump-1').halfX).toBe(numbers.stumpRadius);
    expect(airBetween(byId(level, 'stump-1'), byId(level, 'stump-2'))).toBeCloseTo(numbers.stumpGap, 5);
    expect(byId(level, 'stump-2').top - byId(level, 'stump-1').top).toBeCloseTo(numbers.stumpRise, 5);
    // Root shelves: some step down into the ravine, one fewer climb out.
    expect(count(level, 'shelf')).toBe(numbers.shelfCount * 2 - 1);
    const firstShelf = byId(level, 'shelf-down-1');
    expect(firstShelf.halfX * 2).toBeCloseTo(numbers.shelfSize, 5);
    expect(firstShelf.halfZ * 2).toBeCloseTo(numbers.shelfSize, 5);
    const clearing = byId(level, 'bank-2');
    expect(clearing.z - clearing.halfZ - (firstShelf.z + firstShelf.halfZ)).toBeCloseTo(numbers.shelfGap, 5);
    expect(clearing.top - firstShelf.top).toBeCloseTo(numbers.shelfStep, 5);
    expect(byId(level, 'bank-3').top).toBeCloseTo(clearing.top, 5);
    // One mushroom springs up to each high log, and there are no others.
    expect(count(level, 'mushroom')).toBe(2);
    expect(byId(level, 'mushroom-1').halfX).toBe(numbers.mushroomRadius);
    // The tipping logs: as many, as long and as far apart as the numbers say, each a little higher.
    const tips = level.solids.filter((s) => s.motion?.kind === 'tip');
    expect(tips.map((s) => s.id)).toEqual(Array.from({ length: numbers.tipCount }, (_, i) => `tip-log-${i + 1}`));
    expect(tips[0].halfZ * 2).toBeCloseTo(numbers.tipLength, 5);
    expect(airBetween(byId(level, 'high-log'), tips[0])).toBeCloseTo(numbers.tipGap, 5);
    expect(airBetween(tips[tips.length - 1], byId(level, 'bank-4'))).toBeCloseTo(numbers.tipGap, 5);
    for (let i = 1; i < tips.length; i += 1) expect(tips[i].top - tips[i - 1].top).toBeCloseTo(numbers.tipRise, 5);
    // Crumbling moss, level with the high log of the last climb, then a log to wait on, then the windy boughs.
    const moss = level.solids.filter((s) => s.motion?.kind === 'crumble');
    expect(moss.length).toBe(numbers.mossCount);
    expect(moss[0].halfZ * 2).toBeCloseTo(numbers.mossSize, 5);
    expect(airBetween(byId(level, 'climb-log'), moss[0])).toBeCloseTo(numbers.mossGap, 5);
    for (const pad of moss) expect(pad.top).toBeCloseTo(byId(level, 'climb-log').top, 5);
    expect(airBetween(moss[moss.length - 1], byId(level, 'wind-perch'))).toBeCloseTo(numbers.mossGap, 5);
    const boughs = level.solids.filter((s) => s.motion?.kind === 'sway');
    expect(boughs.length).toBe(numbers.windCount);
    expect(airBetween(byId(level, 'wind-perch'), boughs[0])).toBeCloseTo(numbers.windGap, 5);
    expect(boughs[0].halfX * 2).toBeCloseTo(numbers.boughWidth, 5);
    // Each windy bough rests low level with what comes before it, and rests high level with what comes after.
    const after = [...boughs.slice(1), byId(level, 'bank-6')];
    boughs.forEach((bough, i) => expect(bough.top + numbers.windRise).toBeCloseTo(after[i].top, 5));
    // The first bank is always safe, and so is the chief's at the top; the others are safe when the list names them.
    const banks = level.solids.filter((s) => s.kind === 'bank');
    expect(banks.map((s) => s.safe === true)).toEqual(banks.map((s, i) => i === 0 || s.id === 'bank-6' || numbers.checkpoints.includes(i)));
    expect(level.coyoteTime).toBe(numbers.coyoteTime);
    expect(level.ledgeHelp).toBe(numbers.ledgeHelp);
  });

  it('starts the hero on a safe bank', () => {
    const first = byId(level, level.route[0]);
    expect(first.safe).toBe(true);
    expect(level.spawn.y).toBe(first.top);
  });

  it('takes the ravine down below the clearing and back up, with footing all the way on Easy', () => {
    const floor = byId(level, 'ravine-log-1');
    expect(floor.top).toBeLessThan(byId(level, 'bank-2').top);
    expect(floor.top).toBeGreaterThan(-2);
    // The route never comes back toward the camera.
    for (let i = 1; i < level.route.length; i += 1) {
      expect(byId(level, level.route[i]).z, level.route[i]).toBeLessThan(byId(level, level.route[i - 1]).z + 1e-9);
    }
    if (difficulty === 'easy') {
      // Shelves close enough to walk across and low enough to step up.
      expect(numbers.shelfGap).toBeLessThan(0.6);
      expect(numbers.shelfStep).toBeLessThanOrEqual(numbers.ledgeHelp);
    }
  });

  it('lays the high boughs level, as wide as the numbers say, with a gap at as many corners as they say', () => {
    const boughs = [1, 2, 3, 4, 5].map((i) => byId(level, `bough-${i}`));
    const ledge = byId(level, 'bank-4');
    for (const bough of boughs) {
      expect(bough.top).toBeCloseTo(ledge.top, 5);
      expect(Math.min(bough.halfX, bough.halfZ) * 2).toBeCloseTo(numbers.boughWidth, 5);
    }
    // Forward, across, forward, across, forward.
    expect(boughs.map((b) => b.halfZ > b.halfX)).toEqual([true, false, true, false, true]);
    const gaps = [0, 1, 2, 3].map((i) => airBetween(boughs[i], boughs[i + 1]));
    gaps.forEach((gap, corner) => expect(gap).toBeCloseTo(corner < numbers.boughGapCount ? numbers.boughGap : 0, 5));
    // The first bough runs on from the ledge and the last onto the next bank.
    expect(airBetween(ledge, boughs[0])).toBeCloseTo(0, 5);
    expect(airBetween(boughs[4], byId(level, 'bank-5'))).toBeCloseTo(0, 5);
    // Two corners are jumped away from the camera and two across the screen.
    expect(boughs[1].z + boughs[1].halfZ).toBeLessThanOrEqual(boughs[0].z - boughs[0].halfZ + 1e-9);
    expect(boughs[2].x + boughs[2].halfX).toBeLessThanOrEqual(boughs[1].x - boughs[1].halfX + 1e-9);
    expect(boughs[3].z + boughs[3].halfZ).toBeLessThanOrEqual(boughs[2].z - boughs[2].halfZ + 1e-9);
    expect(boughs[4].x + boughs[4].halfX).toBeLessThanOrEqual(boughs[3].x - boughs[3].halfX + 1e-9);
  });

  it('ends with a climb to the chief’s wide bank, and the bough with the leaf reaching out from its far side', () => {
    const bank = byId(level, 'bank-5');
    const top = byId(level, 'bank-6');
    const bough = byId(level, 'bough');
    expect(byId(level, 'climb-log').top).toBeGreaterThan(bank.top + fullJumpHeight());
    // The windy boughs carry the hero the rest of the way up.
    expect(top.top).toBeCloseTo(byId(level, 'climb-log').top + numbers.windCount * numbers.windRise, 5);
    expect(bough.top).toBe(top.top);
    // The bough starts where the bank ends: no gap to jump between the chief and the leaf.
    expect(bough.z + bough.halfZ).toBeCloseTo(top.z - top.halfZ, 5);
    expect(level.solids.filter((s) => s.kind === 'bank').length).toBe(7);
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
      // A windy bough is left from where it rests high, and is reached where it rests low.
      const fromTop = from.motion?.kind === 'sway' ? from.top + from.motion.rise : from.top;
      expect(air, `${from.id} to ${to.id}`).toBeLessThanOrEqual(jumpReach(to.top - fromTop) * 0.8);
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

  it('leaves room to walk around the mushroom on its bank', () => {
    const bank = byId(level, 'bank-3');
    const mushroom = byId(level, 'mushroom-1');
    expect(mushroom.halfX).toBeLessThan(bank.halfX - 1);
    expect(mushroom.z - mushroom.halfZ).toBeGreaterThan(bank.z - bank.halfZ);
  });
});
