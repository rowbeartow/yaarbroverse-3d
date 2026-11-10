import { describe, expect, it } from 'vitest';
import { Game, IDLE } from '../src/game/game';
import { STEP } from '../src/game/hero';
import { JUMP, RIGHT, hold, start, yard } from './helpers/yard';

/** A yard with the leaf 4 m to the right, at chest height. */
const leafYard = () => yard([], { leaf: { x: 4, y: 0.8, z: 0, radius: 0.7 } });

describe('the golden leaf', () => {
  it('is not reached at the start', () => {
    const game = hold(start(leafYard()), {}, 1);
    expect(game.complete).toBe(false);
    expect(game.summary().complete).toBe(false);
  });

  it('is reached by walking into it', () => {
    const game = hold(start(leafYard()), RIGHT, 2);
    expect(game.complete).toBe(true);
  });

  it('announces the goal exactly once', () => {
    const game = start(leafYard());
    let goals = 0;
    for (let i = 0; i < 3 / STEP; i += 1) {
      game.step({ ...IDLE, ...RIGHT });
      goals += game.events.filter((e) => e.type === 'goal').length;
    }
    expect(goals).toBe(1);
  });

  it('is not reached by walking under it when it is up high', () => {
    const high = yard([], { leaf: { x: 4, y: 3.2, z: 0, radius: 0.7 } });
    expect(hold(start(high), RIGHT, 0.8).complete).toBe(false);
  });

  it('is reached by jumping when it is up high', () => {
    const high = yard([], { leaf: { x: 4, y: 3.2, z: 0, radius: 0.7 } });
    const game = hold(start(high), RIGHT, 0.45);
    hold(game, { ...RIGHT, ...JUMP }, 0.6);
    expect(game.complete).toBe(true);
  });
});

describe('the run record', () => {
  it('counts play time while playing and stops at the leaf', () => {
    const game = hold(start(leafYard()), {}, 2);
    expect(game.seconds).toBeCloseTo(2, 5);
    hold(game, RIGHT, 2);
    const atLeaf = game.seconds;
    expect(atLeaf).toBeGreaterThan(2);
    expect(atLeaf).toBeLessThan(4);
    hold(game, RIGHT, 3);
    expect(game.seconds).toBe(atLeaf);
  });

  it('reports the level, difficulty, hero, time and falls', () => {
    const level = yard([], { leaf: { x: 4, y: 0.8, z: 0, radius: 0.7 }, spawn: { x: -9.5, y: 0, z: 0 } });
    const game = new Game(level, 'hard', 'Caputo');
    // Walk off the left edge once, then walk right to the leaf.
    while (game.falls === 0) game.step({ ...IDLE, moveX: -1 });
    while (!game.complete) game.step({ ...IDLE, ...RIGHT });
    const summary = game.summary();
    expect(summary).toEqual({
      level: 'Test yard',
      difficulty: 'hard',
      hero: 'Caputo',
      seconds: game.seconds,
      falls: 1,
      complete: true,
    });
    expect(summary.seconds).toBeGreaterThan(1);
  });

  it('ignores the buttons after the leaf is reached', () => {
    const game = hold(start(leafYard()), RIGHT, 2);
    hold(game, {}, 0.5);
    const resting = [game.x, game.y, game.z];
    hold(game, { moveX: -1, jump: true }, 1);
    expect([game.x, game.y, game.z]).toEqual(resting);
  });

  it('does not count a fall after the leaf is reached', () => {
    // The leaf hangs past the edge: the hero touches it while dropping.
    const level = yard([], { leaf: { x: 12.1, y: -0.5, z: 0, radius: 0.7 }, spawn: { x: 9, y: 0, z: 0 } });
    const game = hold(start(level), RIGHT, 4);
    expect(game.y).toBeLessThan(level.fallY);
    expect(game.complete).toBe(true);
    expect(game.falls).toBe(0);
  });
});
