import { describe, expect, it } from 'vitest';
import { IDLE } from '../src/game/game';
import { MOVE, STEP, fullJumpHeight, jumpReach } from '../src/game/hero';
import { AWAY, JUMP, LEFT, RIGHT, hold, solid, start, untilLanded, yard } from './helpers/yard';

describe('walking', () => {
  it('stands still when nothing is pressed', () => {
    const game = hold(start(), {}, 1);
    expect([game.x, game.y, game.z]).toEqual([0, 0, 0]);
    expect(game.grounded).toBe(true);
  });

  it('speeds up to walking speed and no faster', () => {
    const game = hold(start(), RIGHT, 1);
    expect(game.vx).toBeCloseTo(MOVE.walkSpeed, 5);
    expect(game.x).toBeGreaterThan(5);
    expect(game.x).toBeLessThan(MOVE.walkSpeed);
  });

  it('walks in each direction the stick points', () => {
    expect(hold(start(), RIGHT, 0.5).x).toBeGreaterThan(1);
    expect(hold(start(), LEFT, 0.5).x).toBeLessThan(-1);
    expect(hold(start(), AWAY, 0.5).z).toBeLessThan(-1);
    expect(hold(start(), { moveZ: 1 }, 0.5).z).toBeGreaterThan(1);
  });

  it('is no faster on a diagonal than straight', () => {
    const game = hold(start(), { moveX: 1, moveZ: -1 }, 1);
    expect(Math.hypot(game.vx, game.vz)).toBeCloseTo(MOVE.walkSpeed, 5);
  });

  it('walks slowly when the stick is pushed a little', () => {
    const game = hold(start(), { moveX: 0.5 }, 1);
    expect(game.vx).toBeCloseTo(MOVE.walkSpeed / 2, 5);
  });

  it('stops soon after the stick is let go', () => {
    const game = hold(start(), RIGHT, 1);
    hold(game, {}, 0.3);
    expect(game.vx).toBe(0);
    const restingX = game.x;
    hold(game, {}, 0.5);
    expect(game.x).toBe(restingX);
  });

  it('turns to face the way it walks', () => {
    expect(hold(start(), RIGHT, 0.3).facing).toBeCloseTo(Math.PI / 2, 5);
    expect(Math.abs(hold(start(), AWAY, 0.3).facing)).toBeCloseTo(Math.PI, 5);
  });

  it('cannot walk through something tall', () => {
    const wall = solid('wall', 4, 0, 1, 5, 3);
    const game = hold(start(yard([wall])), RIGHT, 2);
    expect(game.x).toBeCloseTo(3 - MOVE.bodyRadius, 5);
    expect(game.y).toBe(0);
  });

  it('cannot walk through a round trunk either', () => {
    const trunk = solid('trunk', 4, 0, 1, 1, 3, { shape: 'round' });
    const game = hold(start(yard([trunk])), RIGHT, 2);
    expect(game.x).toBeCloseTo(3 - MOVE.bodyRadius, 3);
  });

  it('steps up a low ledge without jumping, but not a high one', () => {
    const low = hold(start(yard([solid('ledge', 4, 0, 1, 5, 0.25)])), RIGHT, 0.75);
    expect(low.groundId).toBe('ledge');
    expect(low.y).toBe(0.25);
    const high = hold(start(yard([solid('ledge', 4, 0, 1, 5, 0.6)])), RIGHT, 2);
    expect(high.y).toBe(0);
    expect(high.x).toBeLessThan(3);
  });
});

describe('jumping', () => {
  it('a held jump rises about 2 m and comes back down', () => {
    const game = start();
    const highest = untilLanded(game, JUMP);
    expect(highest).toBeGreaterThan(fullJumpHeight() - 0.15);
    expect(highest).toBeLessThanOrEqual(fullJumpHeight());
    expect(game.y).toBe(0);
    expect(game.grounded).toBe(true);
  });

  it('a quick tap makes a shorter hop than a held jump', () => {
    const tap = start();
    tap.step({ ...IDLE, jump: true });
    const tapHeight = untilLanded(tap);
    const held = start();
    const heldHeight = untilLanded(held, JUMP);
    expect(tapHeight).toBeGreaterThan(0.2);
    expect(tapHeight).toBeLessThan(heldHeight * 0.6);
  });

  it('holding Jump does not jump again on landing', () => {
    const game = start();
    untilLanded(game, JUMP);
    hold(game, JUMP, 0.5);
    expect(game.y).toBe(0);
  });

  it('cannot jump again in mid-air', () => {
    const game = start();
    hold(game, JUMP, 0.2);
    const risingSpeed = game.vy;
    game.step(IDLE);
    game.step({ ...IDLE, jump: true });
    expect(game.vy).toBeLessThan(risingSpeed);
    expect(game.events).not.toContainEqual({ type: 'jump' });
  });

  it('a running jump carries about as far as the reach formula says', () => {
    const game = hold(start(yard([], { spawn: { x: -9, y: 0, z: 0 } })), RIGHT, 0.5);
    const takeOff = game.x;
    untilLanded(game, { ...RIGHT, ...JUMP });
    const carried = game.x - takeOff;
    expect(carried).toBeGreaterThan(4);
    expect(carried).toBeLessThan(jumpReach(0));
  });

  it('can still jump for a moment after walking off an edge', () => {
    const game = hold(start(yard([], { spawn: { x: 9, y: 0, z: 0 } })), RIGHT, 0.3);
    expect(game.grounded).toBe(false);
    expect(game.x).toBeGreaterThan(10);
    game.step({ ...IDLE, ...RIGHT, jump: true });
    expect(game.vy).toBeGreaterThan(0);
  });

  it('cannot jump once that moment has passed', () => {
    const game = hold(start(yard([], { spawn: { x: 9, y: 0, z: 0 } })), RIGHT, 0.45);
    expect(game.grounded).toBe(false);
    game.step({ ...IDLE, ...RIGHT, jump: true });
    expect(game.vy).toBeLessThan(0);
  });

  it('a Jump pressed just before landing still jumps', () => {
    const game = start();
    hold(game, JUMP, 0.1);
    while (game.y > 0.2 || game.vy > 0) game.step(IDLE);
    hold(game, JUMP, 0.2);
    expect(game.vy).toBeGreaterThan(0);
    expect(game.y).toBeGreaterThan(0.2);
  });

  it('can jump onto a ledge lower than a full jump', () => {
    const ledge = solid('ledge', 4, 0, 1, 5, 1.5);
    const game = hold(start(yard([ledge])), RIGHT, 0.25);
    untilLanded(game, { ...RIGHT, ...JUMP });
    expect(game.y).toBe(1.5);
    expect(game.groundId).toBe('ledge');
  });

  it('bumps its head on something overhead', () => {
    const roof = solid('roof', 0, 0, 3, 3, 3.2, { bottom: 2.2 });
    const game = start(yard([roof]));
    const highest = untilLanded(game, JUMP);
    expect(highest).toBeCloseTo(2.2 - MOVE.bodyHeight, 5);
  });
});

describe('mushrooms', () => {
  const mushroom = solid('cap', 3, 0, 1, 1, 0.2, { shape: 'round', kind: 'mushroom', bounce: 15 });

  it('launch a hero that walks onto the cap, without pressing Jump', () => {
    const game = start(yard([mushroom]));
    let bounced = false;
    let highest = 0;
    for (let i = 0; i < 2 / STEP; i += 1) {
      game.step({ ...IDLE, moveX: game.x < 3 ? 1 : 0 });
      bounced ||= game.events.some((e) => e.type === 'bounce');
      highest = Math.max(highest, game.y);
    }
    expect(bounced).toBe(true);
    expect(highest).toBeGreaterThan(fullJumpHeight() + 1);
  });

  it('keep bouncing a hero that stays on the cap', () => {
    const game = start(yard([mushroom], { spawn: { x: 3, y: 0.2, z: 0 } }));
    let bounces = 0;
    for (let i = 0; i < 3 / STEP; i += 1) {
      game.step(IDLE);
      bounces += game.events.filter((e) => e.type === 'bounce').length;
    }
    expect(bounces).toBeGreaterThanOrEqual(3);
  });

  it('do not allow a jump in mid-air after a bounce', () => {
    const game = start(yard([mushroom], { spawn: { x: 3, y: 0.2, z: 0 } }));
    game.step(IDLE);
    const afterBounce = game.vy;
    game.step({ ...IDLE, jump: true });
    expect(game.vy).toBeLessThan(afterBounce);
  });
});

describe('falling', () => {
  it('returns the hero to the safe bank and counts the fall', () => {
    const game = start(yard([], { spawn: { x: 9, y: 0, z: 0 } }));
    let steps = 0;
    while (game.falls === 0 && steps < 5 / STEP) {
      game.step({ ...IDLE, ...RIGHT });
      steps += 1;
    }
    expect(game.falls).toBe(1);
    expect(game.events).toContainEqual({ type: 'fall' });
    expect([game.x, game.y, game.z]).toEqual([9, 0, 0]);
    expect([game.vx, game.vy, game.vz]).toEqual([0, 0, 0]);
    expect(game.grounded).toBe(true);
  });

  it('keeps the hero still for a moment after a fall, then lets it move', () => {
    const game = start(yard([], { spawn: { x: 9.5, y: 0, z: 0 } }));
    while (game.falls === 0) game.step({ ...IDLE, ...RIGHT });
    hold(game, { ...LEFT, ...JUMP }, MOVE.returnPause - 0.1);
    expect([game.x, game.y]).toEqual([9.5, 0]);
    hold(game, LEFT, 0.5);
    expect(game.x).toBeLessThan(9);
  });

  it('returns to the last safe bank stood on, not an earlier one', () => {
    const second = solid('second', 13, 0, 2, 5, 0, { safe: true });
    const game = start(yard([second], { spawn: { x: 9, y: 0, z: 0 } }));
    // Jump the 1 m gap onto the second bank, then walk off its far side.
    hold(game, RIGHT, 0.1);
    untilLanded(game, { ...RIGHT, ...JUMP });
    expect(game.groundId).toBe('second');
    while (game.falls === 0) game.step({ ...IDLE, ...RIGHT });
    expect([game.x, game.z]).toEqual([13, 0]);
  });

  it('does not treat a bank that is not safe as a return point', () => {
    const bare = solid('bare', 13, 0, 2, 5, 0);
    const game = start(yard([bare], { spawn: { x: 9, y: 0, z: 0 } }));
    hold(game, RIGHT, 0.1);
    untilLanded(game, { ...RIGHT, ...JUMP });
    expect(game.groundId).toBe('bare');
    while (game.falls === 0) game.step({ ...IDLE, ...RIGHT });
    expect([game.x, game.z]).toEqual([9, 0]);
  });
});
