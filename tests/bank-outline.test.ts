// The drawn top of a bank against the rules: anywhere ground is drawn, a hero
// can stand, so a jump never looks safe when it is not. No screen needed.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { MOVE } from '../src/game/hero';
import { touchesFromAbove, type Solid } from '../src/game/level';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { bankOutline, bankSeed, roundedRect } from '../src/view/bank-outline';

const SAMPLES = 4000;

/** Every bank in the grove, on every difficulty. */
const banks: Array<{ name: string; bank: Solid }> = [];
for (const difficulty of DIFFICULTIES) {
  for (const solid of buildGrove(difficulty).solids) {
    if (solid.kind === 'bank') banks.push({ name: `${solid.id} on ${difficulty}`, bank: solid });
  }
}

const outlineOf = (bank: Solid): ReturnType<typeof bankOutline> =>
  bankOutline(bank.halfX, bank.halfZ, MOVE.footRadius, bankSeed(bank.x, bank.z));

describe('the drawn top of a bank', () => {
  it('there are banks to check', () => {
    expect(banks.length).toBeGreaterThanOrEqual(9);
  });

  for (const { name, bank } of banks) {
    const outline = outlineOf(bank);

    it(`${name}: a hero can stand anywhere ground is drawn`, () => {
      for (let i = 0; i < SAMPLES; i += 1) {
        const edge = outline.at(i / SAMPLES);
        // The edge is the furthest the drawn top reaches, so if the edge is safe, all of it is.
        expect(touchesFromAbove(bank, bank.x + edge.x, bank.z + edge.z, MOVE.footRadius)).toBe(true);
      }
    });

    it(`${name}: the drawn top covers the bank's rectangle along its four sides`, () => {
      // Half way along each side, well away from the rounded corners.
      const right = outline.at(0);
      const far = outline.at(0.25);
      const left = outline.at(0.5);
      const near = outline.at(0.75);
      expect(right.x).toBeGreaterThanOrEqual(bank.halfX);
      expect(left.x).toBeLessThanOrEqual(-bank.halfX);
      expect(Math.abs(far.z)).toBeGreaterThanOrEqual(bank.halfZ);
      expect(Math.abs(near.z)).toBeGreaterThanOrEqual(bank.halfZ);
      // And everywhere, what a corner cuts off is small: under a metre.
      for (let i = 0; i < SAMPLES; i += 1) {
        const edge = outline.at(i / SAMPLES);
        const inside = Math.min(bank.halfX - Math.abs(edge.x), bank.halfZ - Math.abs(edge.z));
        expect(inside).toBeLessThan(1);
      }
    });

    it(`${name}: the edge joins up and has no steps in it`, () => {
      let last = outline.at(0);
      for (let i = 1; i <= SAMPLES; i += 1) {
        const edge = outline.at(i / SAMPLES);
        expect(Math.hypot(edge.x - last.x, edge.z - last.z)).toBeLessThan((outline.length / SAMPLES) * 3);
        last = edge;
      }
    });

    it(`${name}: the edge is not a ruled rectangle`, () => {
      // Along the right-hand side the edge moves in and out by several centimetres.
      const reaches: number[] = [];
      for (let i = -40; i <= 40; i += 1) reaches.push(outline.at(i / 1000).x);
      expect(Math.max(...reaches) - Math.min(...reaches)).toBeGreaterThan(0.04);
    });
  }

  it('gives each bank its own shape', () => {
    const [first, second] = [banks[0].bank, banks[1].bank];
    const a = bankOutline(3.5, 3, MOVE.footRadius, bankSeed(first.x, first.z));
    const b = bankOutline(3.5, 3, MOVE.footRadius, bankSeed(second.x, second.z));
    let differs = 0;
    for (let i = 0; i < 100; i += 1) differs += Math.abs(a.at(i / 100).x - b.at(i / 100).x) + Math.abs(a.at(i / 100).z - b.at(i / 100).z);
    expect(differs).toBeGreaterThan(1);
  });
});

describe('a rectangle with rounded corners', () => {
  it('goes once round, starting half way up the right-hand side', () => {
    const corners = [1, 0.5, 1.5, 0.8] as const;
    const start = roundedRect(0, 4, 3, corners);
    expect([start.x, start.z, start.outX]).toEqual([4, 0, 1]);
    expect(start.outZ).toBeCloseTo(0);
    const half = roundedRect(0.5, 4, 3, corners);
    expect(half.x).toBeCloseTo(-4);
    for (let i = 0; i < 200; i += 1) {
      const edge = roundedRect(i / 200, 4, 3, corners);
      expect(Math.abs(edge.x)).toBeLessThanOrEqual(4 + 1e-9);
      expect(Math.abs(edge.z)).toBeLessThanOrEqual(3 + 1e-9);
      expect(Math.hypot(edge.outX, edge.outZ)).toBeCloseTo(1);
    }
  });
});
