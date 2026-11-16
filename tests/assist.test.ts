// The jump assist (src/game/assist.ts): on Easy and Normal a jump aimed
// roughly at a small piece or a rope steers onto it; Hard has none.

import { describe, expect, it } from 'vitest';
import { JUMP_ASSIST_FOR_TESTS as A } from './helpers/assist-numbers';
import { insideTop, steerJump, timeToFall } from '../src/game/assist';
import type { Difficulty } from '../src/game/difficulty';
import { Game, type Input } from '../src/game/game';
import { STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import type { Rope } from '../src/game/rope';
import { LEVELS } from '../src/levels';

/** A rock to jump from, a narrow log out in deep water, and a bank far off. */
const yard = (difficulty: Difficulty, extra: Partial<Level> = {}): Level => {
  const rock: Solid = { id: 'rock', kind: 'boulder', shape: 'round', x: 0, z: 0, halfX: 1.5, halfZ: 1.5, top: 0.6, bottom: -40, safe: true };
  // 4 m straight ahead (north), 0.8 m wide across the way.
  const log: Solid = { id: 'log', kind: 'log', shape: 'box', x: 0, z: -5.2, halfX: 2, halfZ: 0.4, top: 0.5, bottom: -0.5 };
  const bank: Solid = { id: 'bank', kind: 'bank', shape: 'box', x: 0, z: -30, halfX: 10, halfZ: 4, top: 0.3, bottom: -40 };
  return {
    name: 'yard', solids: [rock, log, bank], spawn: { x: 0, y: 0.6, z: 0 }, leaf: { x: 0, y: 2, z: -30, radius: 0.7 },
    water: [{ id: 'pool', minX: -30, maxX: 30, minZ: -26, maxZ: 20, surface: 0, floor: -4 }],
    fallY: -8, coyoteTime: 0.1, ledgeHelp: 0.3, hearts: 3, protection: 1, knockback: 1, route: ['rock', 'log', 'bank'],
    jumpAssist: A[difficulty], ...extra,
  };
};

/** From the rock's north edge, runs and jumps the way (dx, dz) points, holding it, and says where the hero ends up. */
const jumpToward = (level: Level, dx: number, dz: number, from = { x: 0, z: -1.2 }): { on: string | null; swimming: boolean; target: string | null } => {
  const game = new Game(level, 'normal', 'Yaarbro');
  const size = Math.hypot(dx, dz);
  const stick: Input = { moveX: dx / size, moveZ: dz / size, jump: false };
  Object.assign(game, { x: from.x, z: from.z, vx: stick.moveX * 6, vz: stick.moveZ * 6 });
  let target: string | null = null;
  game.step({ ...stick, jump: true });
  for (let i = 0; i < 2 / STEP && !game.swimming; i += 1) {
    game.step({ ...stick, jump: true });
    target = game.assistTarget ?? target;
    if (game.grounded && i > 5) break;
  }
  return { on: game.grounded ? game.groundId : null, swimming: game.swimming, target };
};

/** An angle off straight north, as a stick direction: positive turns right. */
const off = (degrees: number): [number, number] => [Math.sin((degrees * Math.PI) / 180), -Math.cos((degrees * Math.PI) / 180)];

describe('the jump assist', () => {
  it('a jump aimed a little off a narrow log comes down in the water without it, and on the log with it', () => {
    // 20 degrees off: a keyboard's nearest direction to a log at 25 degrees.
    const [dx, dz] = off(-38);
    expect(jumpToward(yard('hard'), dx, dz)).toMatchObject({ on: null, swimming: true });
    expect(jumpToward(yard('normal'), dx, dz)).toMatchObject({ on: 'log', target: 'log' });
    expect(jumpToward(yard('easy'), dx, dz)).toMatchObject({ on: 'log' });
  });

  it('a jump short of the log is carried onto it, but never further than a jump can go', () => {
    // From further back, so the jump would land just short.
    expect(jumpToward(yard('hard'), 0, -1, { x: 0, z: 0.5 }).swimming).toBe(true);
    expect(jumpToward(yard('normal'), 0, -1, { x: 0, z: 0.5 }).on).toBe('log');
    // The far bank is out of any jump's reach, assist or not.
    const far = yard('easy', { solids: yard('easy').solids.filter((s) => s.id !== 'log') });
    expect(jumpToward(far, 0, -1).swimming).toBe(true);
  });

  it('a stick turned well away, or let go, is a choice to miss: no help', () => {
    const [dx, dz] = off(-70);
    expect(jumpToward(yard('easy'), dx, dz)).toMatchObject({ swimming: true, target: null });
    const game = new Game(yard('easy'), 'easy', 'Yaarbro');
    Object.assign(game, { z: -1.2, vz: -4 });
    for (let i = 0; i < 2 / STEP && !game.swimming; i += 1) game.step({ moveX: 0, moveZ: 0, jump: i < 30 });
    expect(game.assistTarget).toBeNull();
  });

  it('a jump that comes down on big ground on its own is left alone', () => {
    const level = yard('easy');
    const bank = level.solids.find((s) => s.id === 'bank')!;
    const steer = steerJump({ x: 0, y: 1, z: -24, vy: 2, hang: 2.5 }, { x: 0, z: -6 }, level, [], null, null, A.easy!);
    expect(steer.target).toBeNull();
    expect(steer.want).toEqual({ x: 0, z: -6 });
    expect(bank.kind).toBe('bank');
  });

  it('a landing on the very edge of a small piece is brought in from the edge', () => {
    const log = yard('easy').solids.find((s) => s.id === 'log')!;
    const spot = insideTop(log, 2.05, -5.55);
    expect(spot.x).toBeCloseTo(2 - 0.45);
    // A log narrower than twice the inset is aimed at its middle line.
    expect(spot.z).toBeCloseTo(-5.2);
    expect(timeToFall(0.6, 11, 0.5)).toBeGreaterThan(0.7);
    expect(timeToFall(0, 0, 3)).toBeNull();
  });

  it('a jump aimed roughly at a rope takes hold of it', () => {
    const rope: Rope = { id: 'rope', x: 0, y: 0.6 + 2.3 + 7, z: -4.5, length: 7, ahead: { x: 0, z: -1 }, to: 'bank' };
    const level = (difficulty: Difficulty): Level => ({ ...yard(difficulty), solids: yard(difficulty).solids.filter((s) => s.id !== 'log'), ropes: [rope] });
    const [dx, dz] = off(22);
    const held = (difficulty: Difficulty): boolean => {
      const game = new Game(level(difficulty), difficulty, 'Yaarbro');
      Object.assign(game, { z: -1.2, vx: dx * 6, vz: dz * 6 });
      for (let i = 0; i < 2 / STEP && !game.swinging && !game.swimming; i += 1) game.step({ moveX: dx, moveZ: dz, jump: true });
      return game.swinging !== null;
    };
    expect(held('hard')).toBe(false);
    expect(held('normal')).toBe(true);
  });

  it('every level helps on Easy and Normal, and not on Hard, Easy the most (the owner\'s rule)', () => {
    for (const entry of LEVELS) {
      const [e, n, h] = (['easy', 'normal', 'hard'] as const).map((d) => entry.build(d).jumpAssist);
      expect(h, entry.id).toBeUndefined();
      expect(e!.reach, entry.id).toBeGreaterThan(n!.reach);
      expect(e!.angle, entry.id).toBeGreaterThan(n!.angle);
      // Gentle: never more than about half a keyboard direction's width off, nor further than a couple of metres.
      expect(e!.angle).toBeLessThanOrEqual(40);
      expect(e!.reach).toBeLessThanOrEqual(2);
    }
  });
});
