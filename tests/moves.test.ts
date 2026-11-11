// Each hero's own move: Yaarbro's roll and Caputo's pounce. How each fares
// against the enemies is checked with the enemies; this is the moves alone.

import { describe, expect, it } from 'vitest';
import { Game, IDLE } from '../src/game/game';
import { MOVE, STEP } from '../src/game/hero';
import { JUMP, RIGHT, hold, solid, untilLanded, yard } from './helpers/yard';

const MOVE_BUTTON = { move: true };
const speed = (game: Game): number => Math.hypot(game.vx, game.vz);
const as = (hero: 'Yaarbro' | 'Caputo', level = yard()): Game => new Game(level, 'normal', hero);
/** A floor long enough to get a roll up to speed on. */
const longYard = () => yard([solid('long', 40, 0, 40, 5, 0)], { spawn: { x: 2, y: 0, z: 0 } });

describe('Yaarbro’s roll', () => {
  it('builds up past walking speed while the button is held, and no further than rolling speed', () => {
    const game = as('Yaarbro', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 0.2);
    expect(game.rolling).toBe(true);
    expect(speed(game)).toBeGreaterThan(MOVE.walkSpeed);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 1);
    expect(speed(game)).toBeCloseTo(MOVE.rollSpeed, 5);
  });

  it('gets to walking speed as fast as walking does, then gains the rest more slowly', () => {
    const rolling = as('Yaarbro', longYard());
    const walking = as('Yaarbro', longYard());
    hold(rolling, { ...RIGHT, ...MOVE_BUTTON }, 0.1);
    hold(walking, RIGHT, 0.1);
    expect(speed(rolling)).toBeCloseTo(speed(walking), 5);
    hold(rolling, { ...RIGHT, ...MOVE_BUTTON }, 0.1);
    expect(speed(rolling)).toBeLessThan(MOVE.walkSpeed + MOVE.rollAccel * 0.11);
  });

  it('keeps rolling the way he was going when the stick is let go', () => {
    const game = as('Yaarbro', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 0.6);
    const at = game.x;
    hold(game, MOVE_BUTTON, 0.5);
    expect(game.vx).toBeCloseTo(MOVE.rollSpeed, 5);
    expect(game.x).toBeGreaterThan(at + 4);
  });

  it('from a standstill, rolls the way he faces', () => {
    const game = as('Yaarbro', longYard());
    hold(game, RIGHT, 0.3);
    hold(game, {}, 0.5);
    expect(speed(game)).toBe(0);
    hold(game, MOVE_BUTTON, 0.5);
    expect(game.vx).toBeGreaterThan(MOVE.walkSpeed);
    expect(Math.abs(game.vz)).toBeLessThan(1e-6);
  });

  it('slows back to a walk when the button is let go', () => {
    const game = as('Yaarbro', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 1);
    hold(game, RIGHT, 0.3);
    expect(game.rolling).toBe(false);
    expect(speed(game)).toBeCloseTo(MOVE.walkSpeed, 5);
  });

  it('counts as a strike only once he is rolling faster than a walk', () => {
    const game = as('Yaarbro', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 0.05);
    expect(game.rolling).toBe(true);
    expect(game.striking).toBe(false);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 0.4);
    expect(game.striking).toBe(true);
    hold(game, RIGHT, 0.4);
    expect(game.striking).toBe(false);
  });

  it('tucks him down: he is shorter while he rolls', () => {
    const game = as('Yaarbro', longYard());
    expect(game.bodyHeight).toBe(MOVE.bodyHeight);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 0.2);
    expect(game.bodyHeight).toBe(MOVE.rollHeight);
    expect(MOVE.rollHeight).toBeLessThan(MOVE.bodyHeight);
  });

  it('carries into a jump: a roll-jump goes further than a running jump', () => {
    const jumped = (move: boolean): number => {
      const game = as('Yaarbro', longYard());
      hold(game, { ...RIGHT, move }, 1);
      const from = game.x;
      hold(game, { ...RIGHT, ...JUMP, move }, STEP * 2);
      for (let i = 0; i < 600 && !game.grounded; i += 1) game.step({ ...IDLE, ...RIGHT, jump: true, move });
      return game.x - from;
    };
    expect(jumped(true)).toBeGreaterThan(jumped(false) + 1.5);
  });

  it('gains speed in the air too, but slower than on the ground', () => {
    const game = as('Yaarbro', longYard());
    hold(game, RIGHT, 0.5);
    hold(game, { ...RIGHT, ...JUMP }, STEP * 2);
    hold(game, { ...RIGHT, jump: true, move: true }, 0.3);
    expect(game.grounded).toBe(false);
    expect(speed(game)).toBeGreaterThan(MOVE.walkSpeed);
    expect(speed(game)).toBeLessThan(MOVE.walkSpeed + MOVE.rollAccel * 0.3);
  });

  it('is not Caputo’s: holding the button does not roll him', () => {
    const game = as('Caputo', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 1.5);
    expect(game.rolling).toBe(false);
    expect(game.bodyHeight).toBe(MOVE.bodyHeight);
    expect(speed(game)).toBeLessThanOrEqual(MOVE.pounceExitSpeed + 1e-6);
  });
});

describe('Caputo’s pounce', () => {
  it('bursts forward the way the stick points, about twice as fast as a walk, for a fifth of a second', () => {
    const game = as('Caputo', longYard());
    const from = game.x;
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(game.events).toContainEqual({ type: 'pounce' });
    expect(game.vx).toBeCloseTo(MOVE.pounceSpeed, 5);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, MOVE.pounceTime + STEP);
    // The burst lasts a whole number of steps: a fifth of a second, give or take one step.
    expect(game.x - from).toBeGreaterThan(MOVE.pounceSpeed * (MOVE.pounceTime - STEP));
    expect(game.x - from).toBeLessThan(MOVE.pounceSpeed * (MOVE.pounceTime + 2 * STEP));
    expect(game.pouncing).toBe(0);
    expect(speed(game)).toBeLessThanOrEqual(MOVE.pounceExitSpeed + 1e-6);
  });

  it('with the stick let go, goes the way he faces', () => {
    const game = as('Caputo', longYard());
    hold(game, { moveZ: -1 }, 0.3);
    hold(game, {}, 0.5);
    hold(game, MOVE_BUTTON, STEP);
    expect(game.vz).toBeCloseTo(-MOVE.pounceSpeed, 5);
    expect(Math.abs(game.vx)).toBeLessThan(1e-6);
  });

  it('holds its line whatever the stick does while it lasts', () => {
    const game = as('Caputo', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    hold(game, { moveX: -1, move: true }, MOVE.pounceTime / 2);
    expect(game.vx).toBeCloseTo(MOVE.pounceSpeed, 5);
  });

  it('starts with a small hop from the ground, and nothing pulls it down while it lasts', () => {
    const game = as('Caputo', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 10 * STEP);
    expect(game.grounded).toBe(false);
    expect(game.vy).toBeCloseTo(MOVE.pounceHop, 5);
    expect(game.y).toBeCloseTo(MOVE.pounceHop * 10 * STEP, 5);
  });

  it('in the air it goes flat: it neither rises nor falls while it lasts', () => {
    const game = as('Caputo', longYard());
    hold(game, { ...RIGHT, ...JUMP }, 0.3);
    const height = game.y;
    hold(game, { ...RIGHT, jump: true, move: true }, MOVE.pounceTime - STEP);
    expect(game.y).toBeCloseTo(height, 5);
  });

  it('carries a jump further than the jump alone', () => {
    const jumped = (pounce: boolean): number => {
      const game = as('Caputo', longYard());
      hold(game, RIGHT, 0.5);
      const from = game.x;
      hold(game, { ...RIGHT, ...JUMP }, 0.36);
      if (pounce) hold(game, { ...RIGHT, jump: true, move: true }, STEP);
      for (let i = 0; i < 600 && !game.grounded; i += 1) game.step({ ...IDLE, ...RIGHT, jump: true });
      return game.x - from;
    };
    expect(jumped(true)).toBeGreaterThan(jumped(false) + 1.5);
  });

  it('happens once for each time in the air, and is ready again after landing', () => {
    const game = as('Caputo', longYard());
    hold(game, { ...RIGHT, ...JUMP }, 0.2);
    hold(game, { ...RIGHT, jump: true, move: true }, STEP);
    expect(game.pouncing).toBeGreaterThan(0);
    hold(game, { ...RIGHT, jump: true }, MOVE.pounceTime + MOVE.pounceRest + STEP);
    expect(game.grounded).toBe(false);
    hold(game, { ...RIGHT, jump: true, move: true }, STEP);
    expect(game.pouncing).toBe(0);
    untilLanded(game);
    hold(game, RIGHT, MOVE.pounceRest);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(game.pouncing).toBeGreaterThan(0);
  });

  it('needs a fresh press, and a short rest between two', () => {
    const game = as('Caputo', longYard());
    // Holding the button down pounces once, not over and over.
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, 2);
    expect(game.pouncing).toBe(0);
    expect(speed(game)).toBeCloseTo(MOVE.walkSpeed, 5);
    // Two quick presses: the second is too soon after the first.
    hold(game, RIGHT, STEP);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(game.pouncing).toBeGreaterThan(0);
  });

  it('counts as a strike for as long as it lasts, and not after', () => {
    const game = as('Caputo', longYard());
    expect(game.striking).toBe(false);
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(game.striking).toBe(true);
    hold(game, RIGHT, MOVE.pounceTime + STEP);
    expect(game.striking).toBe(false);
  });

  it('is not Yaarbro’s: pressing the button does not pounce him', () => {
    const game = as('Yaarbro', longYard());
    hold(game, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(game.pouncing).toBe(0);
    expect(game.events).not.toContainEqual({ type: 'pounce' });
  });
});

describe('counting moves', () => {
  it('counts each roll begun and each pounce made, and nothing else', () => {
    const yaarbro = as('Yaarbro', longYard());
    hold(yaarbro, { ...RIGHT, ...JUMP }, 0.5);
    expect(yaarbro.movesUsed).toBe(0);
    hold(yaarbro, { ...RIGHT, ...MOVE_BUTTON }, 0.5);
    hold(yaarbro, RIGHT, 0.2);
    hold(yaarbro, { ...RIGHT, ...MOVE_BUTTON }, 0.5);
    expect(yaarbro.movesUsed).toBe(2);

    const caputo = as('Caputo', longYard());
    hold(caputo, { ...RIGHT, ...MOVE_BUTTON }, 1);
    expect(caputo.movesUsed).toBe(1);
  });
});

describe('a move and being hurt', () => {
  it('a hit ends a roll and a pounce, and the button does nothing while the hero is knocked back', () => {
    const rolling = as('Yaarbro', longYard());
    hold(rolling, { ...RIGHT, ...MOVE_BUTTON }, 0.5);
    rolling.hurt(rolling.x + 1, 0);
    hold(rolling, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(rolling.rolling).toBe(false);
    expect(rolling.striking).toBe(false);

    const pouncing = as('Caputo', longYard());
    hold(pouncing, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    pouncing.hurt(pouncing.x + 1, 0);
    expect(pouncing.pouncing).toBe(0);
    expect(pouncing.striking).toBe(false);
    hold(pouncing, RIGHT, STEP);
    hold(pouncing, { ...RIGHT, ...MOVE_BUTTON }, STEP);
    expect(pouncing.pouncing).toBe(0);
  });
});
