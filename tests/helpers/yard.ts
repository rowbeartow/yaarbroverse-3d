// A tiny made-up test yard, so each movement rule can be checked on its own
// without the real level's layout getting in the way.

import { Game, IDLE, type Input } from '../../src/game/game';
import { STEP } from '../../src/game/hero';
import type { Level, Solid } from '../../src/game/level';

const box = (id: string, x: number, z: number, halfX: number, halfZ: number, top: number, extra: Partial<Solid> = {}): Solid => ({
  id,
  kind: 'bank',
  shape: 'box',
  x,
  z,
  halfX,
  halfZ,
  top,
  bottom: top - 50,
  ...extra,
});

/**
 * A flat floor 20 m wide (x from -10 to 10) and 10 m deep, with open air past
 * every edge. Extra solids can be dropped in per test.
 */
export const yard = (extra: Solid[] = [], overrides: Partial<Level> = {}): Level => ({
  name: 'Test yard',
  solids: [box('floor', 0, 0, 10, 5, 0, { safe: true }), ...extra],
  spawn: { x: 0, y: 0, z: 0 },
  leaf: { x: 0, y: 100, z: 0, radius: 0.7 },
  fallY: -6,
  coyoteTime: 0.12,
  ledgeHelp: 0.3,
  hearts: 3,
  protection: 1,
  knockback: 2,
  route: ['floor'],
  ...overrides,
});

export const solid = box;

export const start = (level: Level = yard()): Game => new Game(level, 'normal', 'Yaarbro');

/** Runs the game for a number of seconds with the same input held. */
export const hold = (game: Game, input: Partial<Input>, seconds: number, afterEach?: () => void): Game => {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step({ ...IDLE, ...input });
    afterEach?.();
  }
  return game;
};

/** Runs until the hero is standing on something again (or 5 s pass). Returns the highest point reached. */
export const untilLanded = (game: Game, input: Partial<Input> = {}): number => {
  let highest = game.y;
  for (let i = 0; i < 5 / STEP; i += 1) {
    game.step({ ...IDLE, ...input });
    highest = Math.max(highest, game.y);
    if (game.grounded) break;
  }
  return highest;
};

export const RIGHT = { moveX: 1 };
export const LEFT = { moveX: -1 };
export const AWAY = { moveZ: -1 };
export const JUMP = { jump: true };
